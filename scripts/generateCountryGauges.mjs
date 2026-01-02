import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callGroq } from '../src/iaActions/groqChat.mjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../');

async function generateGauges() {
  console.log('🚀 Démarrage de la génération des jauges pour les pays...\n');

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

  // Extraire tous les pays (exclure "World")
  const countries = Object.entries(countryData)
    .filter(([key]) => key !== 'World')
    .map(([svgId, data]) => ({
      svgId,
      name: data.name,
      longname: data.longname || data.name,
      sovereignty: data.sovereignty || '',
      region: data.region || '',
      population: data.population || 0,
    }));

  console.log(`📊 ${countries.length} pays à traiter\n`);

  // Fichier de sortie
  const outputPath = path.join(projectRoot, 'preset/modern_world/country_gauges.json');
  let existingGauges = {};
  
  // Charger les jauges existantes si le fichier existe
  if (fs.existsSync(outputPath)) {
    try {
      existingGauges = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      console.log(`📂 Fichier existant trouvé avec ${Object.keys(existingGauges).length} pays déjà traités\n`);
    } catch (error) {
      console.warn('⚠️  Impossible de lire le fichier existant, on repart de zéro\n');
    }
  }

  const results = { ...existingGauges };
  let processed = 0;
  let skipped = 0;

  // Traiter les pays par batch de 10 pour éviter de surcharger l'API
  const batchSize = 10;
  for (let i = 0; i < countries.length; i += batchSize) {
    const batch = countries.slice(i, i + batchSize);
    
    console.log(`\n📦 Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(countries.length / batchSize)} (${batch.length} pays)...`);

    for (const country of batch) {
      // Skip si déjà traité
      if (results[country.svgId]) {
        skipped++;
        continue;
      }

      try {
        // Construire le prompt pour l'IA
        const systemPrompt = `You are an expert in geopolitics and economics. Your task is to evaluate a country's economic strength (economy) and military/political power (power) on a scale from 0 to 100, based on the country's context at a specific date.

Context:
- Preset lore: ${lore.substring(0, 500)}
- Starting date: ${startingDate}

You must return ONLY a valid JSON object with this exact structure:
{
  "economy": <number between 0 and 100>,
  "power": <number between 0 and 100>
}

Consider:
- Economy: GDP, economic development, resources, trade capacity, financial stability
- Power: Military strength, political influence, diplomatic weight, technological advancement

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

        results[country.svgId] = {
          economy: Math.round(gauges.economy),
          power: Math.round(gauges.power),
        };

        processed++;
        console.log(`  ✅ ${country.name} (${country.svgId}): economy=${results[country.svgId].economy}, power=${results[country.svgId].power}`);

        // Sauvegarder après chaque pays pour éviter de perdre le travail
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

        // Petite pause pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Erreur pour ${country.name} (${country.svgId}):`, error.message);
        // Continuer avec les valeurs par défaut
        results[country.svgId] = {
          economy: 50,
          power: 50,
        };
        processed++;
      }
    }

    // Pause plus longue entre les batches
    if (i + batchSize < countries.length) {
      console.log('⏸️  Pause de 2 secondes avant le prochain batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Sauvegarder le fichier final
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n✨ Génération terminée !`);
  console.log(`   - Pays traités: ${processed}`);
  console.log(`   - Pays ignorés (déjà traités): ${skipped}`);
  console.log(`   - Fichier sauvegardé: ${outputPath}`);
}

generateGauges()
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

