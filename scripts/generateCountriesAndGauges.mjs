import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callGroq } from '../src/iaActions/groqChat.mjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../');

function randomColor() {
  return (
    '#' +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')
      .toUpperCase()
  );
}

async function generateCountriesAndGauges() {
  console.log('🚀 Démarrage de la génération des pays et des jauges...\n');

  // Lire country-data.json
  const countryDataPath = path.join(projectRoot, 'preset/modern_world/country-data.json');
  const countryData = JSON.parse(fs.readFileSync(countryDataPath, 'utf-8'));

  // Lire modern_world.json pour obtenir la startingDate
  const modernWorldPath = path.join(projectRoot, 'preset/modern_world/modern_world.json');
  const modernWorld = JSON.parse(fs.readFileSync(modernWorldPath, 'utf-8'));
  const startingDate = modernWorld.startingDate || '2020-01-01';

  // Lire le lore pour le contexte
  const lorePath = path.join(projectRoot, 'preset/modern_world/lore.txt');
  const lore = fs.existsSync(lorePath) ? fs.readFileSync(lorePath, 'utf-8') : '';

  // Extraire tous les pays (exclure "World") et enrichir avec les propriétés manquantes
  const countries = Object.entries(countryData)
    .filter(([key]) => key !== 'World')
    .map(([svgId, data]) => ({
      svgId,
      name: data.name,
      longname: data.longname || data.name,
      sovereignty: data.sovereignty || '',
      region: data.region || '',
      population: data.population || 0,
      // Ajouter les propriétés si elles n'existent pas déjà
      independant: data.independant !== undefined ? data.independant : (data.sovereignty === 'UN'),
      color: data.color || randomColor(),
    }));

  console.log(`📊 ${countries.length} pays à traiter (toutes les jauges seront régénérées)\n`);

  let processedGauges = 0;

  // Traiter les pays par batch de 10 pour éviter de surcharger l'API
  const batchSize = 10;
  for (let i = 0; i < countries.length; i += batchSize) {
    const batch = countries.slice(i, i + batchSize);
    
    console.log(`\n📦 Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(countries.length / batchSize)} (${batch.length} pays)...`);

    for (const country of batch) {
      // Générer les jauges pour tous les pays (remplacer les existantes)

      try {
        // Construire le prompt pour l'IA
        const systemPrompt = `You are an expert in geopolitics and economics. Your task is to evaluate a country's economic strength (economy) and power (hard power + soft power) on a scale from 0 to 100, based on the country's context at a specific date.

Context:
- Preset lore: ${lore.substring(0, 500)}
- Starting date: ${startingDate}

You must return ONLY a valid JSON object with this exact structure:
{
  "economy": <number between 0 and 100>,
  "power": <number between 0 and 100>
}

ECONOMY (0-100):
The economy gauge reflects:
- Standard of living (quality of life, purchasing power, access to services)
- State of reserves (foreign exchange reserves, gold reserves, strategic resources)
- Health of debt (debt-to-GDP ratio, ability to service debt, credit rating)
- Economic stability and sustainability

0 = Extreme poverty, no reserves, unsustainable debt
50 = Moderate standard of living, basic reserves, manageable debt
100 = Highest standard of living, massive reserves, excellent debt health

POWER (0-100):
The power gauge reflects BOTH hard power AND soft power:
- Hard power: Military strength, defense capabilities, nuclear arsenal, military technology
- Soft power: Cultural influence, diplomatic weight, economic influence, technological leadership, alliance networks, international institutions control

0 = No man's land (uninhabited or completely powerless territory)
50 = Regional power with moderate influence
100 = The most powerful empire that has ever existed (historical peak of global dominance)

Be realistic and consistent. Major powers (USA, China, Russia, etc.) should have high values. Small or developing countries should have lower values.`;

        const userPrompt = `Country: ${country.name} (${country.longname})
SVG ID: ${country.svgId}
Sovereignty: ${country.sovereignty}
Region: ${country.region}
Population: ${country.population.toLocaleString()}

Date context: ${startingDate}

Evaluate this country's economy and power values for ${startingDate}.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const aiResponse = await callGroq(messages);
        const content = aiResponse.content.trim();

        // Extraire le JSON de la réponse
        let jsonContent = content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        } else {
          const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeMatch) {
            jsonContent = codeMatch[1];
          }
        }

        const gauges = JSON.parse(jsonContent);

        // Valider les valeurs
        if (typeof gauges.economy !== 'number' || gauges.economy < 0 || gauges.economy > 100) {
          throw new Error(`Invalid economy value: ${gauges.economy}`);
        }
        if (typeof gauges.power !== 'number' || gauges.power < 0 || gauges.power > 100) {
          throw new Error(`Invalid power value: ${gauges.power}`);
        }

        // Mettre à jour directement dans countryData
        countryData[country.svgId].economy = Math.round(gauges.economy);
        countryData[country.svgId].power = Math.round(gauges.power);
        // S'assurer que les autres propriétés sont présentes
        if (!countryData[country.svgId].independant) {
          countryData[country.svgId].independant = country.independant;
        }
        if (!countryData[country.svgId].color) {
          countryData[country.svgId].color = country.color;
        }

        processedGauges++;
        console.log(`  ✅ ${country.name} (${country.svgId}): economy=${countryData[country.svgId].economy}, power=${countryData[country.svgId].power}`);

        // Sauvegarder country-data.json après chaque pays pour éviter de perdre le travail
        fs.writeFileSync(countryDataPath, JSON.stringify(countryData, null, '\t'), 'utf-8');

        // Petite pause pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Erreur pour ${country.name} (${country.svgId}):`, error.message);
        // Continuer avec les valeurs par défaut
        countryData[country.svgId].economy = 50;
        countryData[country.svgId].power = 50;
        if (!countryData[country.svgId].independant) {
          countryData[country.svgId].independant = country.independant;
        }
        if (!countryData[country.svgId].color) {
          countryData[country.svgId].color = country.color;
        }
        processedGauges++;
      }
    }

    // Pause plus longue entre les batches
    if (i + batchSize < countries.length) {
      console.log('⏸️  Pause de 2 secondes avant le prochain batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Sauvegarder le fichier final country-data.json
  fs.writeFileSync(countryDataPath, JSON.stringify(countryData, null, '\t'), 'utf-8');

  console.log(`\n✨ Génération terminée !`);
  console.log(`   - Pays traités: ${countries.length}`);
  console.log(`   - Jauges générées/remplacées: ${processedGauges}`);
  console.log(`   - Fichier mis à jour: ${countryDataPath}`);
}

generateCountriesAndGauges()
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

