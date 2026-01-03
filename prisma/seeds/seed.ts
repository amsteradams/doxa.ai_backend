// IMPORTANT: Utiliser dotenv/config qui charge automatiquement le .env
// AVANT tous les autres imports (y compris PrismaClient)
import 'dotenv/config';
import { PrismaClient, UserType, Difficulty } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// Vérifier que DATABASE_URL est chargé
if (!process.env.DATABASE_URL) {
  const cwd = process.cwd();
  const backendDir = cwd.endsWith('backend') ? cwd : path.join(cwd, 'backend');
  const envPath = path.join(backendDir, '.env');
  
  console.error('❌ DATABASE_URL non trouvé dans les variables d\'environnement');
  console.error(`   Répertoire courant: ${cwd}`);
  console.error(`   Fichier .env attendu: ${envPath}`);
  console.error(`   Fichier .env existe: ${fs.existsSync(envPath) ? '✅' : '❌'}`);
  console.error('   Vérifiez que le fichier .env existe et contient DATABASE_URL');
  process.exit(1);
}

console.log(`✅ DATABASE_URL chargé: ${process.env.DATABASE_URL.substring(0, 50)}...`);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed...');

  // Hash du mot de passe pour l'admin
  const hashedPassword = await bcrypt.hash('root', 10);

  // Création de l'utilisateur admin
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin@doxa.local' },
    update: {
      balance: 100000, // Mettre à jour le solde à 100k si l'utilisateur existe déjà
    },
    create: {
      username: 'admin@doxa.local',
      password: hashedPassword,
      userType: UserType.ADMIN,
      balance: 100000, // 100k tokens
    },
  });

  console.log('✅ Utilisateur admin créé:', {
    id: adminUser.id,
    username: adminUser.username,
    userType: adminUser.userType,
    balance: adminUser.balance,
  });

  // Mettre à jour tous les utilisateurs existants avec un solde de 100k
  const updatedUsers = await prisma.user.updateMany({
    data: {
      balance: 100000,
    },
  });

  if (updatedUsers.count > 0) {
    console.log(`✅ ${updatedUsers.count} utilisateur(s) mis à jour avec un solde de 100k tokens`);
  }

  // ============================================
  // SEED PRESET MODERN WORLD
  // ============================================

  // Chemin vers les fichiers du preset (maintenant dans backend/)
  const cwd = process.cwd();
  // Le preset est maintenant dans backend/preset/
  const backendDir = cwd.endsWith('backend') ? cwd : path.join(cwd, 'backend');
  const presetDir = path.join(backendDir, 'preset/modern_world');
  const countryDataPath = path.join(presetDir, 'country-data.json');
  const modernWorldPath = path.join(presetDir, 'modern_world.json');
  const advisorPromptPath = path.join(presetDir, 'advisorPrompt.txt');
  const eventPromptPath = path.join(presetDir, 'eventPromp.txt');
  const chatPromptPath = path.join(presetDir, 'chatPrompt.txt');
  const lorePath = path.join(presetDir, 'lore.txt');

  // Lecture des fichiers
  const modernWorldData = JSON.parse(
    fs.readFileSync(modernWorldPath, 'utf-8')
  );
  const countryData = JSON.parse(fs.readFileSync(countryDataPath, 'utf-8'));
  const advisorPrompt = fs.readFileSync(advisorPromptPath, 'utf-8');
  const eventPrompt = fs.readFileSync(eventPromptPath, 'utf-8');
  const chatPrompt = fs.readFileSync(chatPromptPath, 'utf-8');
  const lore = fs.readFileSync(lorePath, 'utf-8');

  // Suppression de l'ancien preset "Modern World 2020" s'il existe
  const existingPresets = await prisma.preset.findMany({
    where: {
      advisorPrompt: {
        contains: 'Advisor of the player', // Identifiant unique du preset Modern World
      },
    },
  });

  if (existingPresets.length > 0) {
    console.log(`🗑️  Suppression de ${existingPresets.length} preset(s) existant(s)...`);
    for (const oldPreset of existingPresets) {
      await prisma.presetCountry.deleteMany({
        where: { presetId: oldPreset.id },
      });
      await prisma.preset.delete({
        where: { id: oldPreset.id },
      });
    }
  }

  // Création du nouveau preset
  const preset = await prisma.preset.create({
    data: {
      hasProvinces: modernWorldData.hasProvinces || false,
      advisorPrompt: advisorPrompt,
      eventPrompt: eventPrompt,
      chatPrompt: chatPrompt,
      lore: lore,
      startingDate: modernWorldData.startingDate || null,
    },
  });

  console.log('✅ Preset créé:', {
    id: preset.id,
    hasProvinces: preset.hasProvinces,
  });

  // Extraire tous les pays depuis country-data.json (exclure "World")
  const countriesArray = Object.entries(countryData)
    .filter(([key]) => key !== 'World')
    .map(([svgId, data]: [string, any]) => ({
      svgId,
      name: data.name,
      color: data.color || '#000000',
      independant: data.independant !== undefined ? data.independant : (data.sovereignty === 'UN'),
      ownedBy: null,
      surname: data.surname || null,
      economy: data.economy !== undefined ? data.economy : 50,
      power: data.power !== undefined ? data.power : 50,
    }));

  console.log(`📦 ${countriesArray.length} pays à créer depuis country-data.json...`);

  // Création des pays
  let created = 0;
  for (const country of countriesArray) {
    try {
      await prisma.presetCountry.create({
        data: {
          presetId: preset.id,
          name: country.name,
          color: country.color,
          independant: country.independant,
          ownedBy: country.ownedBy,
          surname: country.surname,
          svgId: country.svgId,
          economy: country.economy,
          power: country.power,
        } as any,
      });
      created++;
    } catch (error) {
      console.error(`❌ Erreur lors de la création du pays ${country.name}:`, error);
    }
  }

  console.log(`✅ ${created} pays créés pour le preset ${preset.id}`);

  // ============================================
  // CRÉER DES GAMES DE TEST POUR CHAQUE DIFFICULTÉ
  // ============================================

  // Trouver la France et l'Afghanistan dans les preset_countries
  const france = await prisma.presetCountry.findFirst({
    where: {
      presetId: preset.id,
      name: 'France',
    },
  });

  const afghanistan = await prisma.presetCountry.findFirst({
    where: {
      presetId: preset.id,
      name: 'Afghanistan',
    },
  });

  if (france && afghanistan) {
    // Cloner tous les preset_countries (on le fait une fois pour toutes les games)
    const allPresetCountries = await prisma.presetCountry.findMany({
      where: { presetId: preset.id },
    });

    const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'simulation'];
    const testGames: Array<{ 
      id: string; 
      difficulty: Difficulty; 
      country: string; 
      countryId: string;
      chinaChatId?: string;
      multiChatId?: string;
    }> = [];

    // Créer 4 games avec la France (une par difficulté)
    for (const difficulty of difficulties) {
      // Récupérer les jauges de la France
      const franceGauges = {
        economy: (france as any).economy || 50,
        power: (france as any).power || 50,
        popularity: 50, // Toujours 50 par défaut
      };

      const testGame = await prisma.game.create({
        data: {
          userId: adminUser.id,
          presetId: preset.id,
          selectedCountryId: france.id, // Stocker le pays sélectionné
          currentTurn: 0,
          trame: '',
          gameOver: false,
          currentIngameDate: preset.startingDate || null,
          money: franceGauges.economy,
          power: franceGauges.power,
          popularity: franceGauges.popularity,
          difficulty: difficulty,
        },
      });

      // Cloner tous les preset_countries vers game_countries
      await prisma.gameCountry.createMany({
        data: allPresetCountries.map((pc) => ({
          gameId: testGame.id,
          name: pc.name,
          color: pc.color,
          independant: pc.independant,
          ownedBy: pc.ownedBy,
          surname: pc.surname,
          svgId: pc.svgId,
          economy: (pc as any).economy || 50,
          power: (pc as any).power || 50,
        })),
      });

      // Créer les chats diplomatiques directement
      const china = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'China',
        },
      });

      const germany = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'Germany',
        },
      });

      const england = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'United Kingdom',
        },
      });

      const spain = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'Spain',
        },
      });

      let chinaChatId: string | undefined;
      let multiChatId: string | undefined;

      // Créer le chat avec la Chine
      if (china) {
        const chinaChat = await prisma.$transaction(async (tx) => {
          const chat = await tx.countryChat.create({
            data: {
              gameId: testGame.id,
              globalTrame: '',
              currentTurnContext: '',
            },
          });

          await (tx as any).countryChatCountry.create({
            data: {
              chatId: chat.id,
              countryId: china.id,
              countryTrame: '',
            },
          });

          return chat;
        });
        chinaChatId = chinaChat.id;
        console.log(`  ✅ Chat avec la Chine créé: ${chinaChatId}`);
      }

      // Créer le chat multi avec Germany, United Kingdom et Spain
      if (germany && england && spain) {
        const multiChat = await prisma.$transaction(async (tx) => {
          const chat = await tx.countryChat.create({
            data: {
              gameId: testGame.id,
              globalTrame: '',
              currentTurnContext: '',
            },
          });

          await Promise.all([
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: germany.id,
                countryTrame: '',
              },
            }),
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: england.id,
                countryTrame: '',
              },
            }),
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: spain.id,
                countryTrame: '',
              },
            }),
          ]);

          return chat;
        });
        multiChatId = multiChat.id;
        console.log(`  ✅ Chat multi créé: ${multiChatId}`);
      }

      testGames.push({ 
        id: testGame.id, 
        difficulty: testGame.difficulty,
        country: 'France',
        countryId: france.id,
        chinaChatId: chinaChatId,
        multiChatId: multiChatId,
      });

      console.log(`✅ Game de test créée (${difficulty}, France):`, {
        id: testGame.id,
        userId: testGame.userId,
        presetId: testGame.presetId,
        difficulty: testGame.difficulty,
        selectedCountry: 'France',
        franceId: france.id,
      });
    }

    // Créer 4 games avec l'Afghanistan (une par difficulté)
    for (const difficulty of difficulties) {
      // Récupérer les jauges de l'Afghanistan
      const afghanistanGauges = {
        economy: (afghanistan as any).economy || 50,
        power: (afghanistan as any).power || 50,
        popularity: 50, // Toujours 50 par défaut
      };

      const testGame = await prisma.game.create({
        data: {
          userId: adminUser.id,
          presetId: preset.id,
          selectedCountryId: afghanistan.id, // Stocker le pays sélectionné
          currentTurn: 0,
          trame: '',
          gameOver: false,
          currentIngameDate: preset.startingDate || null,
          money: afghanistanGauges.economy,
          power: afghanistanGauges.power,
          popularity: afghanistanGauges.popularity,
          difficulty: difficulty,
        },
      });

      // Cloner tous les preset_countries vers game_countries
      await prisma.gameCountry.createMany({
        data: allPresetCountries.map((pc) => ({
          gameId: testGame.id,
          name: pc.name,
          color: pc.color,
          independant: pc.independant,
          ownedBy: pc.ownedBy,
          surname: pc.surname,
          svgId: pc.svgId,
          economy: (pc as any).economy || 50,
          power: (pc as any).power || 50,
        })),
      });

      // Créer les chats diplomatiques directement
      const china = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'China',
        },
      });

      const germany = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'Germany',
        },
      });

      const england = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'United Kingdom',
        },
      });

      const spain = await prisma.gameCountry.findFirst({
        where: {
          gameId: testGame.id,
          name: 'Spain',
        },
      });

      let chinaChatId: string | undefined;
      let multiChatId: string | undefined;

      // Créer le chat avec la Chine
      if (china) {
        const chinaChat = await prisma.$transaction(async (tx) => {
          const chat = await tx.countryChat.create({
            data: {
              gameId: testGame.id,
              globalTrame: '',
              currentTurnContext: '',
            },
          });

          await (tx as any).countryChatCountry.create({
            data: {
              chatId: chat.id,
              countryId: china.id,
              countryTrame: '',
            },
          });

          return chat;
        });
        chinaChatId = chinaChat.id;
        console.log(`  ✅ Chat avec la Chine créé: ${chinaChatId}`);
      }

      // Créer le chat multi avec Germany, United Kingdom et Spain
      if (germany && england && spain) {
        const multiChat = await prisma.$transaction(async (tx) => {
          const chat = await tx.countryChat.create({
            data: {
              gameId: testGame.id,
              globalTrame: '',
              currentTurnContext: '',
            },
          });

          await Promise.all([
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: germany.id,
                countryTrame: '',
              },
            }),
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: england.id,
                countryTrame: '',
              },
            }),
            (tx as any).countryChatCountry.create({
              data: {
                chatId: chat.id,
                countryId: spain.id,
                countryTrame: '',
              },
            }),
          ]);

          return chat;
        });
        multiChatId = multiChat.id;
        console.log(`  ✅ Chat multi créé: ${multiChatId}`);
      }

      testGames.push({ 
        id: testGame.id, 
        difficulty: testGame.difficulty,
        country: 'Afghanistan',
        countryId: afghanistan.id,
        chinaChatId: chinaChatId,
        multiChatId: multiChatId,
      });

      console.log(`✅ Game de test créée (${difficulty}, Afghanistan):`, {
        id: testGame.id,
        userId: testGame.userId,
        presetId: testGame.presetId,
        difficulty: testGame.difficulty,
        selectedCountry: 'Afghanistan',
        afghanistanId: afghanistan.id,
      });
    }

    // ============================================
    // RECRÉER test_requetes.txt avec les nouveaux UUIDs
    // ============================================
    // Le fichier test_requetes.txt est à la racine du projet (un niveau au-dessus de backend/)
    const projectRoot = cwd.endsWith('backend') ? path.join(cwd, '..') : cwd;
    const testRequetesPath = path.join(projectRoot, 'test_requetes.txt');
    
    // Supprimer le fichier s'il existe
    if (fs.existsSync(testRequetesPath)) {
      fs.unlinkSync(testRequetesPath);
    }
    
    // Construire le contenu avec une requête pour chaque game
    let fileContent = `créer une new game (France) : 

curl -X POST http://localhost:3000/games   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{
    "presetId": "${preset.id}",
    "selectedCountryId": "${france.id}"
  }'

créer une new game (Afghanistan) : 

curl -X POST http://localhost:3000/games   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{
    "presetId": "${preset.id}",
    "selectedCountryId": "${afghanistan.id}"
  }'

`;

    // Grouper les games par pays
    const franceGames = testGames.filter(g => g.country === 'France');
    const afghanistanGames = testGames.filter(g => g.country === 'Afghanistan');

    // Fonction helper pour générer les requêtes pour une game
    function generateGameRequests(
      gameId: string, 
      difficulty: string, 
      country: string, 
      chinaChatId?: string, 
      multiChatId?: string
    ) {
      let requests = `# ${difficulty.toUpperCase()} - ${country}\n\n`;

      // 1. Chat advisor
      requests += `# 1. Chat advisor\n`;
      requests += `curl -X POST http://localhost:3000/games/${gameId}/advisor/chat   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{\n`;
      requests += `    "message": "quel est l'\''état de mon pays"\n`;
      requests += `}'\n\n`;

      // 2. Lancer une action 'annexer la suisse'
      requests += `# 2. Lancer une action 'annexer la suisse'\n`;
      requests += `curl -X POST http://localhost:3000/games/${gameId}/actions   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{\n`;
      requests += `    "actions": [{"content": "annexer la suisse"}]\n`;
      requests += `}'\n\n`;

      // 5. Parler dans le chat avec la Chine (chat déjà créé dans la seed)
      if (chinaChatId) {
        requests += `# 5. Parler dans le chat avec la Chine\n`;
        requests += `curl -X POST http://localhost:3000/games/${gameId}/country-chat/${chinaChatId}/send-message   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{\n`;
        requests += `    "message": "Bonjour, je souhaite discuter d'\''un accord commercial avec vous."\n`;
        requests += `}'\n\n`;
      }

      // 6. Parler dans le chat multi (chat déjà créé dans la seed)
      if (multiChatId) {
        requests += `# 6. Parler dans le chat multi\n`;
        requests += `curl -X POST http://localhost:3000/games/${gameId}/country-chat/${multiChatId}/send-message   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"   -d '{\n`;
        requests += `    "message": "Bonjour à tous, je souhaite discuter d'\''une alliance stratégique entre nos nations."\n`;
        requests += `}'\n\n`;
      }

      // 7. Move forward
      requests += `# 7. Move forward\n`;
      requests += `curl -X POST http://localhost:3000/games/${gameId}/move-forward   -H "Content-Type: application/json"   -H "x-user-id: ${adminUser.id}"\n\n`;

      requests += `\n`;
      return requests;
    }

    // Ajouter les requêtes pour les games France
    fileContent += `# ============================================\n`;
    fileContent += `# FRANCE\n`;
    fileContent += `# ============================================\n\n`;
    for (const game of franceGames) {
      fileContent += generateGameRequests(
        game.id, 
        game.difficulty.toUpperCase(), 
        'France',
        game.chinaChatId,
        game.multiChatId
      );
    }

    // Ajouter les requêtes pour les games Afghanistan
    fileContent += `# ============================================\n`;
    fileContent += `# AFGHANISTAN\n`;
    fileContent += `# ============================================\n\n`;
    for (const game of afghanistanGames) {
      fileContent += generateGameRequests(
        game.id, 
        game.difficulty.toUpperCase(), 
        'Afghanistan',
        game.chinaChatId,
        game.multiChatId
      );
    }

    // Créer le fichier avec le nouveau contenu
    fs.writeFileSync(testRequetesPath, fileContent, 'utf-8');
    console.log(`✅ Fichier test_requetes.txt recréé avec les UUIDs des games de test (${testGames.length} games: 4 France + 4 Afghanistan)`);
  } else {
    console.warn('⚠️  France ou Afghanistan non trouvée(s) dans les preset_countries');
  }

  console.log('✨ Seed terminé avec succès!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

