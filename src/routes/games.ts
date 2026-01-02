import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { callGroq } from '../iaActions/groqChat';
import fs from 'fs';
import path from 'path';

const router = Router();

// Fonction helper pour générer les réactions (tweets ou messages de taverne)
async function generateReactions(
  gameId: string,
  presetId: string,
  inGameCurrentDate: string,
  events: any[],
  userActions: any[],
  selectedCountry: string,
  difficulty: string,
  newTurnDate: string,
  newTurn: number,
  trame: string
): Promise<{ count: number }> {
  try {
    console.log(`📝 generateReactions appelée: gameId=${gameId}, turn=${newTurn}, events=${events.length}, userActions=${userActions.length}`);
    // Charger le preset pour obtenir la date de départ
    const preset = await prisma.preset.findUnique({
      where: { id: presetId },
      select: {
        startingDate: true,
      },
    });

    const startingDate = preset?.startingDate || inGameCurrentDate;
    const isModernEra = parseInt(startingDate.substring(0, 4)) >= 2010;

    // Charger le prompt de réactions
    const reactionsPromptPath = path.join(__dirname, '../../preset/modern_world/reactionsPrompt.txt');
    let reactionsPrompt = '';
    if (fs.existsSync(reactionsPromptPath)) {
      reactionsPrompt = fs.readFileSync(reactionsPromptPath, 'utf-8').trim();
    }

    // Charger le prompt de difficulté
    const difficultyPromptPath = path.join(__dirname, '../../difficulty', `${difficulty}.txt`);
    let difficultyPrompt = '';
    try {
      if (fs.existsSync(difficultyPromptPath)) {
        difficultyPrompt = fs.readFileSync(difficultyPromptPath, 'utf-8').trim();
      }
    } catch (error) {
      console.warn(`⚠️  Impossible de lire le fichier de difficulté: ${difficultyPromptPath}`);
    }

    // Préparer les données pour l'IA
    const eventsSummary = events.map((e: any) => ({
      date: e.date,
      summary: e.summary,
      description: e.description,
    }));

    const inputData = {
      inGameCurrentDate: newTurnDate,
      startingDate: startingDate,
      events: eventsSummary,
      userActions: userActions,
      selectedCountry: selectedCountry,
      difficulty: difficulty.toUpperCase(),
      difficultyPrompt: difficultyPrompt,
      trame: trame,
    };

    // Remplacer les placeholders dans le prompt
    const systemPrompt = reactionsPrompt
      .replace('{inGameCurrentDate}', newTurnDate)
      .replace('{startingDate}', startingDate)
      .replace('{events}', JSON.stringify(eventsSummary, null, 2))
      .replace('{userActions}', JSON.stringify(userActions, null, 2))
      .replace('{selectedCountry}', selectedCountry)
      .replace('{difficulty}', difficulty.toUpperCase())
      .replace('{trame}', trame || '');

    // Appeler l'IA
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: JSON.stringify(inputData) },
    ];

    const groqResponse = await callGroq(messages);
    const content = groqResponse.content.trim();

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

    const aiResponse = JSON.parse(jsonContent);
    console.log(`📝 AI a généré ${aiResponse.reactions?.length || 0} réactions`);

    // Valider la réponse
    if (!aiResponse.reactions || !Array.isArray(aiResponse.reactions)) {
      throw new Error('Invalid AI response: reactions array is missing');
    }
    
    console.log(`📝 Validation OK, ${aiResponse.reactions.length} réactions à sauvegarder`);

    // Sauvegarder les réactions en BDD
    const reactionType = isModernEra ? 'tweet' : 'taverne';
    const createdReactions = [];
    
    for (const reaction of aiResponse.reactions) {
      const created = await (prisma as any).reaction.create({
        data: {
          gameId: gameId,
          turn: newTurn,
          type: reactionType,
          username: String(reaction.username || '').substring(0, 100),
          content: String(reaction.content || '').substring(0, 2000),
          likes: reactionType === 'tweet' ? (reaction.likes || 0) : null,
          retweets: reactionType === 'tweet' ? (reaction.retweets || 0) : null,
          quotes: reactionType === 'tweet' ? (reaction.quotes || 0) : null,
        },
      });
      createdReactions.push(created);
    }

    return { count: createdReactions.length };
  } catch (error: any) {
    console.error('Error generating reactions:', error);
    throw error;
  }
}

// Fonction helper interne pour générer un message IA
async function generateCountryMessageAI(
  gameId: string,
  chatId: string,
  trame: string,
  messages: any[],
  gauges: { economy: number; power: number; popularity: number },
  chatPrompt: string,
  difficulty: string,
  difficultyPrompt: string,
  actingCountry: { name: string; independant: boolean; ownedBy: string | null; surname: string | null },
  targetCountries: any[],
  ingameDate: string | null,
  lore: string,
  underlyingPressures?: string
): Promise<{ message: string; leaveAfterTalking: boolean; leaveDate: string | null } | null> {
  try {
    // Construire le contexte JSON pour l'IA
    const contextJson: any = {
      difficulty: difficulty,
      lore: lore || '',
      trame: trame,
      ingameDate: ingameDate || null,
      actingCountry: actingCountry,
      targetCountries: targetCountries,
    };

    // Ajouter les messages passés si fournis
    if (messages && Array.isArray(messages)) {
      contextJson.currentChatHistory = messages.map((msg: any) => ({
        speaker: msg.userId ? 'USER' : 'COUNTRY',
        country: msg.countryName || null,
        message: msg.content || msg.message || '',
        date: msg.ingameDate || ingameDate || null,
      }));
    }

    // Ajouter underlyingPressures si fourni
    if (underlyingPressures && typeof underlyingPressures === 'string' && underlyingPressures.trim() !== '') {
      contextJson.underlyingPressures = underlyingPressures.trim();
    }

    // Construire le prompt système avec la difficulté
    const systemPrompt = `You must know that the player is playing on difficulty: ${difficulty}
${difficultyPrompt ? `\n${difficultyPrompt}` : ''}

${chatPrompt}

CRITICAL OUTPUT REQUIREMENT: You must respond ONLY with a valid JSON object in this exact format:
{
  "message": "your diplomatic response text here",
  "leaveAfterTalking": false,
  "leaveDate": null
}

Do not include any text before or after the JSON. Do not use markdown code blocks. Return only the raw JSON object.`;

    // Construire les messages pour l'IA
    const messagesForAI: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CONTEXT:\n${JSON.stringify(contextJson, null, 2)}` },
    ];

    // Appeler l'IA avec retry logic
    let aiResponse: any = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const groqResponse = await callGroq(messagesForAI);
        const content = groqResponse.content.trim();

        // Extraire le JSON de la réponse
        let jsonContent = content;
        
        // Essayer d'extraire depuis un bloc de code markdown
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        } else {
          const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeMatch) {
            jsonContent = codeMatch[1];
          } else {
            // Essayer de trouver un objet JSON dans le texte (chercher le premier { et le dernier })
            const firstBrace = content.indexOf('{');
            if (firstBrace !== -1) {
              // Trouver le dernier } qui correspond au premier {
              let braceCount = 0;
              let lastBrace = -1;
              for (let i = firstBrace; i < content.length; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastBrace = i;
                    break;
                  }
                }
              }
              if (lastBrace !== -1) {
                jsonContent = content.substring(firstBrace, lastBrace + 1);
              }
            }
          }
        }

        // Nettoyer le contenu JSON (supprimer les espaces en début/fin)
        jsonContent = jsonContent.trim();

        aiResponse = JSON.parse(jsonContent);

        // Validation de la réponse IA
        if (!aiResponse.message || typeof aiResponse.message !== 'string') {
          throw new Error('Invalid AI response: message is required and must be a string');
        }

        if (typeof aiResponse.leaveAfterTalking !== 'boolean') {
          throw new Error('Invalid AI response: leaveAfterTalking must be a boolean');
        }

        if (aiResponse.leaveDate !== null && typeof aiResponse.leaveDate !== 'string') {
          throw new Error('Invalid AI response: leaveDate must be null or a string');
        }

        // Sanitization du message
        aiResponse.message = aiResponse.message.trim().substring(0, 2000);

        // Validation réussie
        break;
      } catch (error: any) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to get valid AI response after ${maxRetries} attempts: ${error.message}`);
        }
        console.warn(`⚠️  Tentative ${retryCount} échouée, retry...`);
      }
    }

    return {
      message: aiResponse.message,
      leaveAfterTalking: aiResponse.leaveAfterTalking,
      leaveDate: aiResponse.leaveDate,
    };
  } catch (error: any) {
    console.error('Error in generateCountryMessageAI:', error);
    return null;
  }
}

// POST /games
router.post('/', async (req: Request, res: Response) => {
  try {
    const { presetId, selectedCountryId, difficulty } = req.body;
    const mockUserId = req.headers['x-user-id'] as string;

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!presetId) {
      return res.status(400).json({ error: 'presetId is required' });
    }

    // Transaction Prisma pour créer le jeu
    const game = await prisma.$transaction(async (tx) => {
      // ✅ Vérifier que le preset existe
      const preset = await tx.preset.findUnique({
        where: { id: presetId },
      });

      if (!preset) {
        throw new Error('Preset not found');
      }

      // ✅ Vérifier que le pays choisi existe dans preset_countries et est souverain (si fourni)
      let selectedCountry = null;
      if (selectedCountryId) {
        selectedCountry = await tx.presetCountry.findFirst({
          where: {
            id: selectedCountryId,
            presetId: presetId,
          },
        });

        if (!selectedCountry) {
          throw new Error('Selected country not found in preset');
        }

        // Vérifier que le pays est souverain (independant === true)
        if (!(selectedCountry as any).independant) {
          throw new Error('Selected country must be a sovereign country (independant)');
        }
      }

      // ✅ Récupérer les jauges du pays sélectionné (ou valeurs par défaut)
      const initialMoney = selectedCountry ? ((selectedCountry as any).economy || 50) : 50;
      const initialPower = selectedCountry ? ((selectedCountry as any).power || 50) : 50;
      const initialPopularity = 50; // Toujours 50 par défaut

      // ✅ Créer la game
      const newGame = await tx.game.create({
        data: {
          userId: mockUserId,
          presetId: presetId,
          selectedCountryId: selectedCountryId || null, // Stocker le pays sélectionné
          currentTurn: 0,
          trame: '',
          gameOver: false,
          currentIngameDate: (preset as any).startingDate || null, // date de départ du preset
          difficulty: (difficulty || 'medium') as any, // difficulté par défaut: medium
          money: initialMoney,
          power: initialPower,
          popularity: initialPopularity,
        } as any,
      });

      // ✅ Cloner tous les preset_countries → game_countries
      const presetCountries = await tx.presetCountry.findMany({
        where: { presetId: presetId },
      });

      await tx.gameCountry.createMany({
        data: presetCountries.map((pc) => ({
          gameId: newGame.id,
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

      return newGame;
    });

    // ✅ Retourner la game créée avec les indicateurs initiaux
    res.status(201).json({
      id: game.id,
      userId: game.userId,
      presetId: game.presetId,
      currentTurn: game.currentTurn,
      trame: game.trame,
      gameOver: game.gameOver,
      currentIngameDate: game.currentIngameDate,
      money: (game as any).money || 50,
      power: (game as any).power || 50,
      popularity: (game as any).popularity || 50,
      createdAt: game.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating game:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (error.message === 'Preset not found') {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    if (error.message === 'Selected country not found in preset') {
      return res.status(400).json({ error: 'Selected country not found in preset' });
    }
    
    if (error.message === 'Selected country must be a sovereign country (independant)') {
      return res.status(400).json({ error: 'Selected country must be a sovereign country (independant)' });
    }

    res.status(500).json({ 
      error: 'Failed to create game',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /games
router.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: Filtrer par utilisateur connecté
    const mockUserId = req.headers['x-user-id'] as string;

    const where = mockUserId ? { userId: mockUserId } : {};

      const games = await prisma.game.findMany({
      where,
      select: {
        id: true,
        userId: true,
        presetId: true,
        trame: true,
        currentTurn: true,
        currentIngameDate: true,
        tokensSpent: true,
        gameOver: true,
        createdAt: true,
        lastPlay: true,
        preset: {
          select: {
            id: true,
            hasProvinces: true,
          },
        },
      } as any,
      orderBy: {
        lastPlay: 'desc',
      },
    });

    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// GET /games/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        presetId: true,
        trame: true,
        currentTurn: true,
        currentIngameDate: true,
        tokensSpent: true,
        gameOver: true,
        createdAt: true,
        lastPlay: true,
        preset: {
          select: {
            id: true,
            hasProvinces: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// GET /games/:id/countries
router.get('/:id/countries', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const countries = await prisma.gameCountry.findMany({
      where: { gameId: id },
      select: {
        id: true,
        name: true,
        color: true,
        independant: true,
        ownedBy: true,
        surname: true,
        svgId: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(countries);
  } catch (error) {
    console.error('Error fetching game countries:', error);
    res.status(500).json({ error: 'Failed to fetch game countries' });
  }
});

// GET /games/:id/events
router.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Récupérer les GameEvents
    const events = await (prisma as any).gameEvent.findMany({
      where: { gameId: id },
      select: {
        id: true,
        turn: true,
        date: true,
        resume: true,
        text: true,
        createdAt: true,
      },
      orderBy: {
        turn: 'desc',
      },
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching game events:', error);
    res.status(500).json({ error: 'Failed to fetch game events' });
  }
});

// GET /games/:id/chat
router.get('/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Récupérer les chats advisor et country
    const [advisorChat, countryChats] = await Promise.all([
      prisma.advisorChat.findFirst({
        where: { gameId: id },
        include: {
          messages: {
            select: {
              id: true,
              sender: true,
              content: true,
              tokenCost: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
      prisma.countryChat.findMany({
        where: { gameId: id },
        include: {
          messages: {
            select: {
              id: true,
              countryName: true,
              content: true,
              react: true,
              ingameDate: true,
              tokenCost: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          countries: {
            select: {
              country: {
                select: {
                  id: true,
                  name: true,
                  svgId: true,
                },
              },
              countryTrame: true,
            },
          },
        },
      }),
    ]);

    res.json({
      advisorChat,
      countryChats,
    });
  } catch (error) {
    console.error('Error fetching game chat:', error);
    res.status(500).json({ error: 'Failed to fetch game chat' });
  }
});

// GET /games/:id/indicators
router.get('/:id/indicators', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        lastPlay: true,
        createdAt: true,
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Récupérer les indicateurs séparément
    const indicators = await prisma.game.findUnique({
      where: { id },
      select: {
        money: true,
        power: true,
        popularity: true,
        difficulty: true,
      } as any,
    });

    res.json({
      money: indicators?.money ?? 50,
      power: indicators?.power ?? 50,
      popularity: indicators?.popularity ?? 50,
      lastUpdated: game.lastPlay || game.createdAt,
    });
  } catch (error) {
    console.error('Error fetching game indicators:', error);
    res.status(500).json({ error: 'Failed to fetch game indicators' });
  }
});

// POST /games/:id/actions
router.post('/:id/actions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actions } = req.body;
    const mockUserId = req.headers['x-user-id'] as string;

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({ error: 'actions must be an array' });
    }

    if (actions.length === 0) {
      return res.status(400).json({ error: 'actions array cannot be empty' });
    }

    if (actions.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 actions per turn allowed' });
    }

    // Vérifier que chaque action a un content
    for (const action of actions) {
      if (!action.content || typeof action.content !== 'string' || action.content.trim() === '') {
        return res.status(400).json({ error: 'Each action must have a non-empty content field' });
      }
    }

    // Récupérer la game
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        currentTurn: true,
        currentIngameDate: true,
        gameOver: true,
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Vérifier que l'utilisateur est le propriétaire
    if (game.userId !== mockUserId) {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    // Vérifier que le jeu n'est pas terminé
    if (game.gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // Créer les actions dans une transaction
    const createdActions = await prisma.$transaction(
      actions.map((action: { content: string }) =>
        (prisma as any).gameAction.create({
          data: {
            gameId: id,
            userId: mockUserId,
            turn: game.currentTurn,
            ingameDate: game.currentIngameDate || '',
            content: action.content.trim(),
          },
        })
      )
    );

    res.status(201).json({
      actions: createdActions.map((action) => ({
        id: action.id,
        turn: action.turn,
        ingameDate: action.ingameDate,
        content: action.content,
        createdAt: action.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error creating game actions:', error);
    res.status(500).json({ error: 'Failed to create game actions', message: error.message });
  }
});

// DELETE /games/:id/actions/:actionId
router.delete('/:id/actions/:actionId', async (req: Request, res: Response) => {
  try {
    const { id, actionId } = req.params;
    const mockUserId = req.headers['x-user-id'] as string;

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Vérifier que la game existe et que l'utilisateur est le propriétaire
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        currentTurn: true,
        gameOver: true,
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameUserId = (game as any).userId as string;
    if (gameUserId !== mockUserId) {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    if ((game as any).gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // Vérifier que l'action existe, appartient à la game, au tour actuel et à l'utilisateur
    const action = await (prisma as any).gameAction.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        gameId: true,
        userId: true,
        turn: true,
        content: true,
      },
    });

    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (action.gameId !== id) {
      return res.status(400).json({ error: 'Action does not belong to this game' });
    }

    if (action.userId !== mockUserId) {
      return res.status(403).json({ error: 'Unauthorized: not the action owner' });
    }

    const currentTurn = (game as any).currentTurn as number;
    if (action.turn !== currentTurn) {
      return res.status(400).json({ error: 'Action does not belong to the current turn' });
    }

    // Supprimer l'action
    await (prisma as any).gameAction.delete({
      where: { id: actionId },
    });

    res.status(200).json({
      message: 'Action deleted successfully',
      actionId: actionId,
    });
  } catch (error: any) {
    console.error('Error deleting game action:', error);
    
    if (error.message === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (error.message === 'Unauthorized: not the game owner') {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    if (error.message === 'Game is over') {
      return res.status(400).json({ error: 'Game is over' });
    }

    if (error.message === 'Action not found') {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.status(500).json({
      error: 'Failed to delete game action',
      message: error.message,
    });
  }
});

// POST /games/:id/advisor/chat
router.post('/:id/advisor/chat', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { message } = req.body;
    const mockUserId = req.headers['x-user-id'] as string;

    console.log('📥 POST /games/:id/advisor/chat - Body reçu:', JSON.stringify(req.body, null, 2));
    console.log('📥 Headers:', { 'x-user-id': mockUserId, gameId: id });
    console.log('⏱️  Début de la requête advisor chat');

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Récupérer les données nécessaires AVANT la transaction (pour éviter le timeout)
    const step1Start = Date.now();
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        presetId: true,
        selectedCountryId: true,
        trame: true,
        currentTurn: true,
        currentIngameDate: true,
        gameOver: true,
        money: true,
        power: true,
        popularity: true,
        difficulty: true,
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Récupérer le pays sélectionné depuis la game
    let selectedCountry = 'Non défini';
    const gameSelectedCountryId = (game as any).selectedCountryId as string | null;
    
    if (gameSelectedCountryId) {
      // Récupérer le preset_country pour obtenir le nom et svgId
      const preset = await prisma.preset.findUnique({
        where: { id: (game as any).presetId as string },
        include: {
          presetCountries: {
            where: { id: gameSelectedCountryId },
            select: {
              name: true,
              svgId: true,
            },
          },
        },
      });
      
      if (preset && preset.presetCountries.length > 0) {
        const country = preset.presetCountries[0];
        selectedCountry = `${country.name} (${country.svgId})`;
      }
    }
    const step1Duration = Date.now() - step1Start;
    console.log(`⏱️  Étape 1 - Lecture game: ${step1Duration}ms`);

    // Vérifier que l'utilisateur est le propriétaire
    const gameUserId = (game as any).userId as string;
    if (gameUserId !== mockUserId) {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    // Vérifier que le jeu n'est pas terminé
    if (game.gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // Récupérer le preset avec lore et advisorPrompt
    const step2Start = Date.now();
    const gamePresetId = (game as any).presetId as string | null;
    if (!gamePresetId) {
      return res.status(404).json({ error: 'Game has no preset' });
    }

    const preset = await prisma.preset.findUnique({
      where: { id: gamePresetId },
      select: {
        id: true,
        lore: true,
        advisorPrompt: true,
      } as any,
    });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    const step2Duration = Date.now() - step2Start;
    console.log(`⏱️  Étape 2 - Lecture preset: ${step2Duration}ms`);

    // Récupérer l'utilisateur avec le solde et le type
    const step3Start = Date.now();
    const user = await prisma.user.findUnique({
      where: { id: mockUserId },
      select: {
        id: true,
        balance: true,
        userType: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const step3Duration = Date.now() - step3Start;
    console.log(`⏱️  Étape 3 - Lecture user: ${step3Duration}ms`);
    console.log('💰 Solde utilisateur:', { userId: user.id, balance: user.balance, userType: user.userType });

    // Récupérer uniquement les messages du tour courant
    const step4Start = Date.now();
    const advisorChat = await prisma.advisorChat.findFirst({
      where: { gameId: id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    const step4Duration = Date.now() - step4Start;
    console.log(`⏱️  Étape 4 - Lecture advisorChat: ${step4Duration}ms`);

    // Récupérer les country chats du tour actuel
    const step4bStart = Date.now();
    const countryChats = await prisma.countryChat.findMany({
      where: { gameId: id },
      include: {
        countries: {
          include: {
            country: {
              select: {
                name: true,
                svgId: true,
              },
            },
          },
        },
        messages: {
          where: {
            // Filtrer par tour si nécessaire (pour l'instant on prend tous les messages)
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    const step4bDuration = Date.now() - step4bStart;
    console.log(`⏱️  Étape 4b - Lecture countryChats: ${step4bDuration}ms`);

    // Récupérer les actions du tour actuel
    const step4cStart = Date.now();
    const currentTurn = (game as any).currentTurn as number;
    const userActions = await (prisma as any).gameAction.findMany({
      where: {
        gameId: id,
        turn: currentTurn,
      },
      select: {
        id: true,
        content: true,
        ingameDate: true,
      },
    });
    const step4cDuration = Date.now() - step4cStart;
    console.log(`⏱️  Étape 4c - Lecture userActions: ${step4cDuration}ms`);

    // Construire le contexte pour l'IA
    const step5Start = Date.now();
    const presetLore = (preset as any).lore || '';
    const presetAdvisorPrompt = preset.advisorPrompt || '';
    
    // Lire le prompt de difficulté
    const gameDifficulty = (game as any).difficulty as string;
    const difficultyPromptPath = path.join(__dirname, '../../difficulty', `${gameDifficulty}.txt`);
    let difficultyPrompt = '';
    
    try {
      if (fs.existsSync(difficultyPromptPath)) {
        difficultyPrompt = fs.readFileSync(difficultyPromptPath, 'utf-8').trim();
      }
    } catch (error) {
      console.warn(`⚠️  Impossible de lire le fichier de difficulté: ${difficultyPromptPath}`);
    }
    
    // Construire le contexte des country chats avec les messages complets
    let countryChatsContext = '';
    if (countryChats.length > 0) {
      const countryChatsDetails: string[] = [];
      for (const chat of countryChats) {
        // Récupérer les pays du chat
        const chatCountries = chat.countries.map((cc: any) => cc.country.name).join(', ');
        
        // Construire l'historique des messages
        if (chat.messages && chat.messages.length > 0) {
          const messagesHistory = chat.messages.map((msg: any) => {
            const speaker = msg.userId ? 'Vous' : (msg.countryName || 'Pays');
            return `  - ${speaker}: ${msg.content.substring(0, 300)}`;
          }).join('\n');
          
          countryChatsDetails.push(`Conversation avec ${chatCountries}:\n${messagesHistory}`);
        } else {
          // Si pas de messages mais un résumé existe
          for (const chatCountry of chat.countries) {
            const summary = chatCountry.countryTrame || chat.currentTurnContext || '';
            if (summary.trim()) {
              countryChatsDetails.push(`${chatCountry.country.name} (${chatCountry.country.svgId}): ${summary.substring(0, 200)}`);
            }
          }
        }
      }
      if (countryChatsDetails.length > 0) {
        countryChatsContext = `\n\nÉchanges diplomatiques récents:\n${countryChatsDetails.join('\n\n')}`;
      }
    }

    // Construire le résumé des actions du tour actuel
    let userActionsContext = '';
    if (userActions.length > 0) {
      const actionsList = userActions.map((action: any) => `- ${action.content}`).join('\n');
      userActionsContext = `\n\nActions planifiées par le joueur pour ce tour (pas encore actives, résultats non connus):\n${actionsList}\n\nNote: Ces actions seront exécutées lors du prochain "move forward". Leur impact sur le monde n'est pas encore déterminé.`;
    }

    const systemPrompt = `${presetLore}

${presetAdvisorPrompt}

You must know that the player is playing on difficulty: ${gameDifficulty}
${difficultyPrompt ? `\n${difficultyPrompt}` : ''}

Pays sélectionné par le joueur: ${selectedCountry}

Résumé factuel du monde (trame):
${game.trame || 'Aucun événement majeur pour le moment.'}

Tour actuel: ${game.currentTurn}
Date in-game: ${game.currentIngameDate || 'Non définie'}

Indicateurs actuels:
- Resources (Money): ${game.money}/100
- Popularity: ${game.popularity}/100
- Power: ${game.power}/100${countryChatsContext}${userActionsContext}`;

    // Construire l'historique des messages du tour courant
    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (advisorChat) {
      // Filtrer les messages du tour courant (pour l'instant, on prend tous les messages)
      // TODO: Filtrer par tour si nécessaire
      for (const msg of advisorChat.messages) {
        if (msg.sender === 'user') {
          historyMessages.push({ role: 'user', content: msg.content });
        } else if (msg.sender === 'advisor') {
          historyMessages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Construire les messages pour Groq
    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message.trim() },
    ];
    const step5Duration = Date.now() - step5Start;
    console.log(`⏱️  Étape 5 - Construction prompt: ${step5Duration}ms`);
    console.log('🤖 Appel Groq - Messages envoyés:', JSON.stringify(groqMessages.map(m => ({ role: m.role, contentLength: m.content.length })), null, 2));
    console.log('🤖 System prompt (premiers 500 caractères):', systemPrompt.substring(0, 500));

    // Appeler Groq (EN DEHORS de la transaction pour éviter le timeout)
    const step6Start = Date.now();
    const aiResponse = await callGroq(groqMessages);
    const step6Duration = Date.now() - step6Start;
    console.log(`⏱️  Étape 6 - Appel Groq: ${step6Duration}ms (${(step6Duration / 1000).toFixed(2)}s)`);

    console.log('🤖 Réponse Groq reçue:', {
      contentLength: aiResponse.content.length,
      usage: aiResponse.usage,
      contentPreview: aiResponse.content.substring(0, 200) + '...',
    });

    // Vérifier le solde de l'utilisateur
    const tokensRequired = aiResponse.usage.total_tokens;
    const isAdmin = user.userType === 'ADMIN';
    
    console.log('💰 Vérification solde:', {
      balance: user.balance,
      tokensRequired,
      difference: user.balance - tokensRequired,
      isAdmin,
    });

    // Seul l'admin peut bypasser la vérification de solde
    const shouldDebit = !isAdmin || user.balance >= tokensRequired;
    
    if (user.balance < tokensRequired) {
      if (isAdmin) {
        console.warn('⚠️  Admin: bypass de la vérification de solde');
        // On continue pour l'admin
      } else {
        return res.status(402).json({ error: 'Insufficient balance' });
      }
    }

    // Transaction pour persister les données (après l'appel Groq)
    const step7Start = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      // Créer ou récupérer le chat advisor
      let chat = advisorChat;
      if (!chat) {
        chat = await tx.advisorChat.create({
          data: {
            gameId: id,
            advisorTrame: '',
            currentTurnContext: '',
          },
          include: {
            messages: true,
          },
        });
      }

      // Sanitizer et limiter la longueur des messages (protection contre les attaques)
      const sanitizedUserMessage = message.trim().substring(0, 10000); // Limiter à 10k caractères
      const sanitizedAiResponse = aiResponse.content.substring(0, 50000); // Limiter à 50k caractères

      // Persister les messages
      const userMessage = await tx.advisorMessage.create({
        data: {
          chatId: chat.id,
          gameId: id,
          userId: mockUserId,
          sender: 'user',
          content: sanitizedUserMessage, // Contenu sanitized et limité
          tokenCost: 0, // Le coût est sur la réponse complète
          createdAt: new Date(),
        },
      });

      const advisorMessage = await tx.advisorMessage.create({
        data: {
          chatId: chat.id,
          gameId: id,
          userId: mockUserId, // Relier le message advisor au propriétaire de la game
          sender: 'advisor',
          content: sanitizedAiResponse, // Contenu sanitized et limité
          tokenCost: aiResponse.usage.total_tokens,
          createdAt: new Date(),
        },
      });

      // Mettre à jour le currentTurnContext (avec contenu sanitized)
      const updatedContext = chat.currentTurnContext 
        ? `${chat.currentTurnContext}\nUser: ${sanitizedUserMessage.substring(0, 200)}\nAdvisor: ${sanitizedAiResponse.substring(0, 200)}...`
        : `User: ${sanitizedUserMessage.substring(0, 200)}\nAdvisor: ${sanitizedAiResponse.substring(0, 200)}...`;

      await tx.advisorChat.update({
        where: { id: chat.id },
        data: {
          currentTurnContext: updatedContext.substring(0, 1000), // Limiter à 1000 caractères
        },
      });

      // Débiter l'utilisateur (seulement si on doit débiter)
      if (shouldDebit) {
        await tx.user.update({
          where: { id: mockUserId },
          data: {
            balance: {
              decrement: aiResponse.usage.total_tokens,
            },
          },
        });
        console.log('💰 Solde débité:', { tokens: aiResponse.usage.total_tokens });
      } else {
        console.warn('⚠️  Admin: solde non débité (insuffisant)');
      }

      // Mettre à jour les tokens dépensés du jeu
      await tx.game.update({
        where: { id },
        data: {
          tokensSpent: {
            increment: aiResponse.usage.total_tokens,
          },
        },
      });

      // Calculer le nouveau solde
      const newBalance = shouldDebit 
        ? user.balance - aiResponse.usage.total_tokens 
        : user.balance; // Admin avec solde insuffisant, on ne débite pas

      return {
        message: advisorMessage,
        usage: aiResponse.usage,
        newBalance: newBalance,
      };
    });
    const step7Duration = Date.now() - step7Start;
    console.log(`⏱️  Étape 7 - Transaction Prisma: ${step7Duration}ms`);

    const response = {
      id: result.message.id,
      content: result.message.content,
      sender: result.message.sender,
      tokenCost: result.message.tokenCost,
      usage: result.usage,
      newBalance: result.newBalance,
      createdAt: result.message.createdAt,
    };

    const totalDuration = Date.now() - startTime;
    console.log(`⏱️  ===== RÉSUMÉ DES TEMPS =====`);
    console.log(`⏱️  Étape 1 - Lecture game: ${step1Duration}ms`);
    console.log(`⏱️  Étape 2 - Lecture preset: ${step2Duration}ms`);
    console.log(`⏱️  Étape 3 - Lecture user: ${step3Duration}ms`);
    console.log(`⏱️  Étape 4 - Lecture advisorChat: ${step4Duration}ms`);
    console.log(`⏱️  Étape 5 - Construction prompt: ${step5Duration}ms`);
    console.log(`⏱️  Étape 6 - Appel Groq: ${step6Duration}ms (${(step6Duration / 1000).toFixed(2)}s)`);
    console.log(`⏱️  Étape 7 - Transaction Prisma: ${step7Duration}ms`);
    console.log(`⏱️  TOTAL: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log('📤 POST /games/:id/advisor/chat - Réponse envoyée:', JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(`❌ Erreur dans advisor chat après ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s):`, error);

    if (error.message === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (error.message === 'Unauthorized: not the game owner') {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    if (error.message === 'Game is over') {
      return res.status(400).json({ error: 'Game is over' });
    }

    if (error.message === 'Insufficient balance') {
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    if (error.message === 'GROQ_API_KEY is not configured' || error.message === 'GROQ_CHAT_MODEL is not configured') {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    res.status(500).json({ error: 'Failed to process advisor chat' });
  }
});

// POST /games/:id/move-forward
router.post('/:id/move-forward', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mockUserId = req.headers['x-user-id'] as string;

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ============================================
    // COLLECTE DES DONNÉES (EN DEHORS DE LA TRANSACTION)
    // ============================================

    // 1. Load game data
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        presetId: true,
        selectedCountryId: true,
        currentIngameDate: true,
        difficulty: true,
        money: true,
        power: true,
        popularity: true,
        trame: true,
        currentTurn: true,
        gameOver: true,
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameUserId = (game as any).userId as string;
    if (gameUserId !== mockUserId) {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    const gameOver = (game as any).gameOver as boolean;
    if (gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // 2. Load preset data
    const gamePresetId = (game as any).presetId as string | null;
    if (!gamePresetId) {
      return res.status(404).json({ error: 'Game has no preset' });
    }

    const preset = await prisma.preset.findUnique({
      where: { id: gamePresetId },
      select: {
        lore: true,
        eventPrompt: true,
      } as any,
    });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // 3. Load selected country from game.selectedCountryId
    const gameSelectedCountryId = (game as any).selectedCountryId as string | null;
    let selectedCountry = '';

    if (gameSelectedCountryId) {
      // Récupérer le preset_country pour obtenir le svgId
      const selectedPresetCountry = await prisma.presetCountry.findUnique({
        where: { id: gameSelectedCountryId },
        select: {
          svgId: true,
          name: true,
        },
      });

      if (selectedPresetCountry) {
        selectedCountry = selectedPresetCountry.svgId;
      } else {
        return res.status(400).json({ error: 'Selected country not found in preset' });
      }
    } else {
      // Fallback: utiliser le premier game_country si selectedCountryId n'est pas défini
      const selectedCountryData = await prisma.gameCountry.findFirst({
        where: { gameId: id },
        select: {
          svgId: true,
        },
      });

      if (!selectedCountryData) {
        return res.status(400).json({ error: 'No countries found in game' });
      }

      selectedCountry = selectedCountryData.svgId;
    }

    // 4. Load country chats with messages
    const countryChats = await prisma.countryChat.findMany({
      where: { gameId: id },
      include: {
        countries: {
          include: {
            country: {
              select: {
                svgId: true,
                name: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            userId: true,
            countryName: true,
            content: true,
            ingameDate: true,
            createdAt: true,
          },
        },
      },
    });

    // Construire les résumés avec les messages du tour en cours
    const countryChatsSummary: Array<{ country: string; summary: string; messages?: Array<{ speaker: string; country: string | null; message: string; date: string | null }> }> = [];
    for (const chat of countryChats) {
      for (const chatCountry of chat.countries) {
        const summary = chatCountry.countryTrame || chat.currentTurnContext || '';
        
        // Récupérer les messages du chat pour ce pays (filtrer par pays si nécessaire)
        const chatMessages = chat.messages.map((msg: any) => ({
          speaker: msg.userId ? 'USER' : 'COUNTRY',
          country: msg.countryName || null,
          message: msg.content || '',
          date: msg.ingameDate || null,
        }));

        if (summary.trim() || chatMessages.length > 0) {
          countryChatsSummary.push({
            country: chatCountry.country.svgId,
            summary: summary.substring(0, 500), // Limiter la longueur
            messages: chatMessages.length > 0 ? chatMessages : undefined,
          });
        }
      }
    }

    // 5. Load advisor chat
    const advisorChat = await prisma.advisorChat.findFirst({
      where: { gameId: id },
    });

    const advisorChatSummary = advisorChat?.currentTurnContext || advisorChat?.advisorTrame || '';

    // 6. Load user actions for current turn
    const currentTurn = (game as any).currentTurn as number;
    const userActions = await (prisma as any).gameAction.findMany({
      where: {
        gameId: id,
        turn: currentTurn,
      },
      select: {
        id: true,
        content: true,
      },
    });

    const userActionsFormatted = userActions.map((action: any) => ({
      actionId: action.id,
      description: action.content,
    }));

    // 6.5. Load available countries for AI
    const availableCountries = await prisma.gameCountry.findMany({
      where: {
        gameId: id,
        independant: true, // Only sovereign countries can initiate chats
      },
      select: {
        name: true,
        svgId: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 7. Load difficulty prompt
    const gameDifficulty = (game as any).difficulty as string;
    const difficultyPromptPath = path.join(__dirname, '../../difficulty', `${gameDifficulty}.txt`);
    let difficultyPrompt = '';
    try {
      if (fs.existsSync(difficultyPromptPath)) {
        difficultyPrompt = fs.readFileSync(difficultyPromptPath, 'utf-8').trim();
      }
    } catch (error) {
      console.warn(`⚠️  Impossible de lire le fichier de difficulté: ${difficultyPromptPath}`);
    }

    // 8. Parse trame into array format
    const gameTrame = (game as any).trame as string;
    const trameArray: Array<{ date: string; summary: string }> = [];
    if (gameTrame) {
      // Simple parsing: assume format like "date: summary\n" or JSON-like
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(gameTrame);
        if (Array.isArray(parsed)) {
          trameArray.push(...parsed);
        }
      } catch {
        // If not JSON, try to parse line by line
        const lines = gameTrame.split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          const match = line.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
          if (match) {
            trameArray.push({
              date: match[1],
              summary: match[2],
            });
          }
        }
      }
    }

    // 9. Build INPUT JSON
    const inputData = {
      inGameCurrentDate: ((game as any).currentIngameDate as string) || '',
      selectedCountry: selectedCountry,
      difficulty: gameDifficulty.toUpperCase(),
      difficultyPrompt: difficultyPrompt,
      language: 'fr',
      lorePrompt: (preset as any).lore || '',
      gauges: {
        economy: (game as any).money as number,
        power: (game as any).power as number,
        popularity: (game as any).popularity as number,
      },
      countryChats: countryChatsSummary,
      advisorChat: {
        summary: advisorChatSummary,
      },
      trame: trameArray,
      userActions: userActionsFormatted,
      availableCountries: availableCountries.map((c: any) => ({
        name: c.name,
        svgId: c.svgId,
      })),
    };

    // 10. Build system prompt
    const worldEngineInstructions = `
You are the World Engine of a turn-based geopolitical simulation game.

Your role is to simulate the evolution of the world over time based strictly on the provided INPUT, and to produce an OUTPUT that follows the exact structure described below.
You must not add commentary, explanations, or text outside of the JSON output.

You must return a single JSON object with the following top-level keys ONLY:
- events
- updatedGauges
- countryChatsSummary (or null)
- advisorSummary
- borderChanges (or null)
- gameOver (or null)

Do not include any additional keys.
Do not include any text outside of the JSON.
`;

    const systemPrompt = `${(preset as any).eventPrompt || ''}

${difficultyPrompt}

${worldEngineInstructions}`;

    // 11. Call AI with retry logic (EN DEHORS DE LA TRANSACTION)
    let aiResponse: any = null;
    let retryCount = 0;
    const maxRetries = 3;
    let lastValidationError: string | null = null;

    while (retryCount < maxRetries) {
      try {
        // Construire le prompt système avec l'erreur de validation précédente si elle existe
        let currentSystemPrompt = systemPrompt;
        if (lastValidationError) {
          currentSystemPrompt += `\n\n⚠️ CRITICAL: Your previous response was rejected because: ${lastValidationError}\nPlease fix this issue in your response.`;
        }

        const messages = [
          { role: 'system' as const, content: currentSystemPrompt },
          { role: 'user' as const, content: JSON.stringify(inputData) },
        ];

        const groqResponse = await callGroq(messages);
        const content = groqResponse.content.trim();

        // Try to extract JSON from response (might have markdown code blocks)
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

        aiResponse = JSON.parse(jsonContent);

        // Validate response structure
        const requiredKeys = ['events', 'updatedGauges', 'advisorSummary'];
        const optionalKeys = ['countryChatsSummary', 'borderChanges', 'gameOver'];

        const hasAllRequired = requiredKeys.every((key) => key in aiResponse);
        if (!hasAllRequired) {
          throw new Error(`Missing required keys: ${requiredKeys.filter((k) => !(k in aiResponse)).join(', ')}`);
        }

        // Validation: Check if events mention diplomatic contact, condemnations, protests, or strong reactions but no diplomaticChats are created
        if (aiResponse.events && Array.isArray(aiResponse.events)) {
          const diplomaticPhrases = [
            'initie un contact diplomatique',
            'envoie un message diplomatique',
            'envoient des messages diplomatiques',
            'ont envoyé un message diplomatique',
            'ont adressé des messages diplomatiques',
            'a adressé un message diplomatique',
            'adressé des messages diplomatiques',
            'demande des éclaircissements',
            'demandent des éclaircissements',
            'sollicitant',
            'sollicite',
            'demande une réunion',
            'demandent une réunion',
            'initiates diplomatic contact',
            'sends a diplomatic message',
            'sends diplomatic messages',
            'sent a diplomatic message',
            'sent diplomatic messages',
            'demands clarification',
            'demand clarification',
            'contact diplomatique',
            'diplomatic contact',
            'diplomatic message',
            'message diplomatique',
            'messages diplomatiques',
            'a initié',
            'ont envoyé',
            'a envoyé',
            'ont adressé',
            'a adressé',
            'envoie',
            'envoient',
            'adressé',
            'adressent'
          ];

          // Phrases indicating condemnations, protests, or strong reactions that should trigger chats
          const reactionPhrases = [
            'condamne',
            'condamnation',
            'condamner',
            'condamné',
            'condamnation',
            'condemns',
            'condemnation',
            'proteste',
            'protestation',
            'protestent',
            'protests',
            'protestation',
            'exprime son inquiétude',
            'expriment leur inquiétude',
            'expresses concern',
            'expressing concern',
            'préoccupation',
            'concern',
            'worries',
            'worried',
            'réagit',
            'réagissent',
            'reacts',
            'react',
            'menacé',
            'menacée',
            'threatened',
            'affecté',
            'affectée',
            'affected',
            'dénonce',
            'dénoncent',
            'denounces',
            'denounce'
          ];

          // Phrases à exclure (ne sont PAS des contacts diplomatiques)
          const excludePhrases = [
            'marchés financiers',
            'marché financier',
            'bourses',
            'investisseurs',
            'traders',
            'analystes financiers',
            'réagissent positivement',
            'réagissent négativement',
            'anticipent',
            'financial markets',
            'stock market',
            'investors',
            'traders',
            'financial analysts',
            'manifestations',
            'manifestation',
            'manifestants',
            'manifestant',
            'protests',
            'protesters',
            'protesting',
            'sondages',
            'sondage',
            'polls',
            'poll',
            'popularité',
            'popularity',
            'sondages d\'opinion',
            'opinion polls',
          ];
          
          const eventsWithDiplomaticContact = aiResponse.events.filter((event: any) => {
            const description = (event.description || '').toLowerCase();
            const summary = (event.summary || '').toLowerCase();
            
            // Exclure les événements qui contiennent des phrases d'exclusion
            const hasExcludePhrase = excludePhrases.some((phrase: string) => 
              description.includes(phrase.toLowerCase()) || summary.includes(phrase.toLowerCase())
            );
            
            if (hasExcludePhrase) {
              return false; // Ne pas considérer comme contact diplomatique
            }
            
            const allPhrases = [...diplomaticPhrases, ...reactionPhrases];
            return allPhrases.some(phrase => description.includes(phrase.toLowerCase()) || summary.includes(phrase.toLowerCase()));
          });

          // Check that events with diplomatic contact have chatInitiated=true
          const eventsWithoutChat = eventsWithDiplomaticContact.filter((e: any) => e.chatInitiated !== true);
          if (eventsWithoutChat.length > 0) {
            const eventExamples = eventsWithoutChat.slice(0, 3).map((e: any) => `"${e.summary}"`).join(', ');
            const errorMessage = `INVALID RESPONSE: ${eventsWithoutChat.length} event(s) mention diplomatic contact, condemnations, protests, or strong reactions (examples: ${eventExamples}) but chatInitiated is not true. You MUST set chatInitiated=true, provide chatContent, and list countries in countryInvolved (using exact names from INPUT's availableCountries) for EACH such event.`;
            console.warn(`⚠️  ${errorMessage}`);
            lastValidationError = errorMessage;
            throw new Error(errorMessage);
          }
        }

        // Validate events
        if (!Array.isArray(aiResponse.events) || aiResponse.events.length < 3 || aiResponse.events.length > 20) {
          throw new Error(`Invalid events array: must have 3-20 items, got ${aiResponse.events?.length || 0}`);
        }

        // Validate each event has required fields including chatInitiated, chatContent, and countryInvolved
        for (let i = 0; i < aiResponse.events.length; i++) {
          const event = aiResponse.events[i];
          if (!event.date || !event.summary || !event.description) {
            throw new Error(`Event at index ${i} is missing required fields: date, summary, or description`);
          }
          if (typeof event.chatInitiated !== 'boolean') {
            throw new Error(`Event at index ${i} is missing or has invalid chatInitiated field (must be boolean)`);
          }
          if (event.chatInitiated === true) {
            if (!event.chatContent || typeof event.chatContent !== 'string' || event.chatContent.trim().length === 0) {
              throw new Error(`Event at index ${i} has chatInitiated=true but chatContent is missing, null, or empty`);
            }
            if (!Array.isArray(event.countryInvolved) || event.countryInvolved.length === 0) {
              throw new Error(`Event at index ${i} has chatInitiated=true but countryInvolved is missing, null, or empty array`);
            }
          }
          if (event.chatInitiated === false) {
            if (event.chatContent !== null) {
              throw new Error(`Event at index ${i} has chatInitiated=false but chatContent is not null`);
            }
            if (event.countryInvolved !== null) {
              throw new Error(`Event at index ${i} has chatInitiated=false but countryInvolved is not null`);
            }
          }
        }

        // Validate updatedGauges
        if (!aiResponse.updatedGauges || typeof aiResponse.updatedGauges !== 'object') {
          throw new Error('Invalid updatedGauges: must be an object');
        }

        const requiredGauges = ['economy', 'power', 'popularity'];
        const hasAllGauges = requiredGauges.every((key) => key in aiResponse.updatedGauges);
        if (!hasAllGauges) {
          throw new Error(`Missing required gauges: ${requiredGauges.filter((k) => !(k in aiResponse.updatedGauges)).join(', ')}`);
        }

        // Validate advisorSummary
        if (!aiResponse.advisorSummary || typeof aiResponse.advisorSummary !== 'object') {
          throw new Error('Invalid advisorSummary: must be an object');
        }

        if (!aiResponse.advisorSummary.date || !aiResponse.advisorSummary.summary) {
          throw new Error('advisorSummary must have date and summary');
        }

        // Success - break retry loop
        lastValidationError = null; // Reset error on success
        break;
      } catch (error: any) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`AI response validation failed after ${maxRetries} attempts: ${error.message}`);
        }
        console.warn(`⚠️  AI response validation failed (attempt ${retryCount}/${maxRetries}):`, error.message);
        // Store the error message for the next retry
        if (!lastValidationError || error.message.includes('diplomatic')) {
          lastValidationError = error.message;
        }
        // Continue to retry
      }
    }

    if (!aiResponse) {
      throw new Error('Failed to get valid AI response');
    }

    // ============================================
    // PERSISTENCE DES DONNÉES (TRANSACTION RAPIDE)
    // ============================================

    // Transaction pour toutes les opérations de persistence
    const result = await prisma.$transaction(async (tx) => {
      // 12. Persist events
      const createdEvents = [];
      // Map to store chat info for each event (eventIndex -> { chatId, countryNames })
      const eventChatMap: Map<number, { chatId: string; countryNames: string[] }> = new Map();
      
      for (const event of aiResponse.events) {
        const createdEvent = await (tx as any).gameEvent.create({
          data: {
            gameId: id,
            turn: currentTurn,
            date: event.date,
            resume: event.summary,
            text: event.description,
          },
        });
        // Store the original event data with chatInitiated, chatContent, and countryInvolved for the response
        createdEvents.push({
          ...createdEvent,
          chatInitiated: event.chatInitiated || false,
          chatContent: event.chatContent || null,
          countryInvolved: event.countryInvolved || null, // Will be overridden by actual chat data if chat is created
        });
      }

      // 13. Update trame with events and diplomatic conversations
      const newTrameEntries = aiResponse.events.map((e: any) => ({
        date: e.date,
        summary: e.summary,
      }));

      // Ajouter les résumés des conversations diplomatiques à la trame
      if (aiResponse.countryChatsSummary && Array.isArray(aiResponse.countryChatsSummary)) {
        for (const chatSummary of aiResponse.countryChatsSummary) {
          if (chatSummary && chatSummary.country && chatSummary.summary && chatSummary.date) {
            // Sanitizer le résumé
            const sanitizedSummary = String(chatSummary.summary).substring(0, 500);
            const sanitizedDate = String(chatSummary.date).substring(0, 10);
            
            newTrameEntries.push({
              date: sanitizedDate,
              summary: `[Diplomatie] ${chatSummary.country}: ${sanitizedSummary}`,
            });
          }
        }
      }

      // Trier les entrées par date
      newTrameEntries.sort((a: any, b: any) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });

      let updatedTrame: string = gameTrame || '';
      if (updatedTrame) {
        try {
          const existingTrame = JSON.parse(updatedTrame);
          if (Array.isArray(existingTrame)) {
            updatedTrame = JSON.stringify([...existingTrame, ...newTrameEntries]);
          } else {
            updatedTrame = JSON.stringify([...newTrameEntries]);
          }
        } catch {
          // If not JSON, append as new lines
          const newLines = newTrameEntries.map((e: any) => `${e.date}: ${e.summary}`).join('\n');
          updatedTrame = updatedTrame ? `${updatedTrame}\n${newLines}` : newLines;
        }
      } else {
        updatedTrame = JSON.stringify(newTrameEntries);
      }

      // 14. Update gauges
      await tx.game.update({
        where: { id },
        data: {
          money: aiResponse.updatedGauges.economy,
          power: aiResponse.updatedGauges.power,
          popularity: aiResponse.updatedGauges.popularity,
          trame: updatedTrame,
        } as any,
      });

      // 15. Update country chats summary (avec sanitization)
      if (aiResponse.countryChatsSummary && Array.isArray(aiResponse.countryChatsSummary)) {
        for (const summary of aiResponse.countryChatsSummary) {
          // Find the country chat country entry
          const gameCountry = await tx.gameCountry.findFirst({
            where: {
              gameId: id,
              svgId: String(summary.country || '').substring(0, 10), // Sanitizer le svgId
            },
          });

          if (gameCountry) {
            const countryChat = await tx.countryChat.findFirst({
              where: { gameId: id },
            });

            if (countryChat) {
              // Sanitizer le résumé
              const sanitizedSummary = String(summary.summary || '').substring(0, 2000);
              
              // Update or create country_chat_countries entry
              await (tx as any).countryChatCountry.upsert({
                where: {
                  chatId_countryId: {
                    chatId: countryChat.id,
                    countryId: gameCountry.id,
                  },
                },
                update: {
                  countryTrame: sanitizedSummary,
                },
                create: {
                  chatId: countryChat.id,
                  countryId: gameCountry.id,
                  countryTrame: sanitizedSummary,
                },
              } as any);
            }
          }
        }
      }

      // 16. Create diplomatic chats based on chatInitiated and chatContent from events
      for (let eventIndex = 0; eventIndex < aiResponse.events.length; eventIndex++) {
        const event = aiResponse.events[eventIndex];
        
        if (event.chatInitiated === true && event.chatContent && event.countryInvolved && Array.isArray(event.countryInvolved) && event.countryInvolved.length > 0) {
          // Sanitizer les données
          const sanitizedMessage = String(event.chatContent || '').substring(0, 2000);
          const sanitizedDate = String(event.date || '').substring(0, 10);
          const countryNamesFromAI = event.countryInvolved.map((name: any) => String(name).trim()).filter((name: string) => name.length > 0);

          if (countryNamesFromAI.length === 0 || countryNamesFromAI.length > 4) {
            console.warn(`⚠️  Invalid countryInvolved count for event ${eventIndex}, skipping chat creation`);
            continue;
          }

          // Trouver les game_countries correspondants par nom (case-insensitive, partial match)
          const gameCountries = await tx.gameCountry.findMany({
            where: {
              gameId: id,
              independant: true, // Only sovereign countries
            },
            select: {
              id: true,
              svgId: true,
              name: true,
            },
          });

          // Match countries by name (case-insensitive, partial match)
          const matchedCountries: any[] = [];
          for (const countryNameFromAI of countryNamesFromAI) {
            const matched = gameCountries.find((gc: any) => 
              gc.name.toLowerCase().includes(countryNameFromAI.toLowerCase()) ||
              countryNameFromAI.toLowerCase().includes(gc.name.toLowerCase())
            );
            if (matched && !matchedCountries.find(c => c.id === matched.id)) {
              matchedCountries.push(matched);
            }
          }

          if (matchedCountries.length === 0) {
            console.warn(`⚠️  No countries found matching ${countryNamesFromAI.join(', ')} for event ${eventIndex}, skipping chat creation`);
            continue;
          }

          // Créer le CountryChat
          const newChat = await tx.countryChat.create({
            data: {
              gameId: id,
              globalTrame: '',
              currentTurnContext: `Chat créé automatiquement suite à l'événement du ${sanitizedDate}`,
            },
          });

          // Créer les CountryChatCountry pour chaque pays
          await Promise.all(
            matchedCountries.map((country) =>
              (tx as any).countryChatCountry.create({
                data: {
                  chatId: newChat.id,
                  countryId: country.id,
                  countryTrame: '',
                },
              })
            )
          );

          // Créer le message initial (du premier pays dans la liste)
          if (matchedCountries.length > 0) {
            const firstCountry = matchedCountries[0];
            await (tx as any).countryMessage.create({
              data: {
                chatId: newChat.id,
                gameId: id,
                userId: null, // Message automatique, pas de userId
                countryName: firstCountry.name,
                content: sanitizedMessage,
                ingameDate: sanitizedDate,
                tokenCost: 0,
                react: null,
              },
            });
          }

          // Store chat info for this event
          const countryNames = matchedCountries.map((c: any) => c.name);
          eventChatMap.set(eventIndex, {
            chatId: newChat.id,
            countryNames: countryNames,
          });

          console.log(`✅ Diplomatic chat créé avec ${countryNames.join(', ')} associé à l'événement ${eventIndex}`);
        }
      }

      // 17. Update advisor summary (avec sanitization)
      if (advisorChat) {
        let updatedAdvisorTrame = advisorChat.advisorTrame || '';
        const sanitizedSummary = String(aiResponse.advisorSummary?.summary || '').substring(0, 2000);
        
        if (aiResponse.advisorSummary.memory && Array.isArray(aiResponse.advisorSummary.memory)) {
          const memoryText = aiResponse.advisorSummary.memory
            .map((m: any) => `${String(m.type || '').substring(0, 50)}: ${String(m.description || '').substring(0, 500)}`)
            .join('\n');
          updatedAdvisorTrame = updatedAdvisorTrame
            ? `${updatedAdvisorTrame}\n${sanitizedSummary}\n${memoryText}`
            : `${sanitizedSummary}\n${memoryText}`;
        } else {
          updatedAdvisorTrame = updatedAdvisorTrame
            ? `${updatedAdvisorTrame}\n${sanitizedSummary}`
            : sanitizedSummary;
        }

        await tx.advisorChat.update({
          where: { id: advisorChat.id },
          data: {
            advisorTrame: updatedAdvisorTrame.substring(0, 5000), // Limiter la longueur
          },
        });
      }

      // 17. Handle border changes (avec sanitization)
      if (aiResponse.borderChanges && Array.isArray(aiResponse.borderChanges)) {
        for (const borderChange of aiResponse.borderChanges) {
          // Sanitizer les svgId
          const fromSvgId = String(borderChange.from || '').substring(0, 10);
          const toSvgId = borderChange.to ? String(borderChange.to).substring(0, 10) : null;
          
          // Find the action (we'll create a placeholder action if needed)
          // For now, we'll just update game_countries directly
          const fromCountry = await tx.gameCountry.findFirst({
            where: {
              gameId: id,
              svgId: fromSvgId,
            },
          });

          const toCountry = toSvgId
            ? await tx.gameCountry.findFirst({
                where: {
                  gameId: id,
                  svgId: toSvgId,
                },
              })
            : null;

          if (fromCountry) {
            await tx.gameCountry.update({
              where: { id: fromCountry.id },
              data: {
                ownedBy: toCountry ? String(toCountry.name).substring(0, 100) : null, // Sanitizer le nom
                independant: !toCountry,
              } as any,
            });
          }
        }
      }

      // 18. Handle game over
      if (aiResponse.gameOver) {
        await tx.game.update({
          where: { id },
          data: {
            gameOver: true,
          },
        });
      }

      // 19. Generate reactions (EN DEHORS DE LA TRANSACTION - appel IA)
      // Cette étape sera faite après la transaction pour éviter les timeouts

      // 20. Advance turn
      const lastEventDate = aiResponse.events.length > 0
        ? aiResponse.events[aiResponse.events.length - 1].date
        : ((game as any).currentIngameDate as string) || '';

      await tx.game.update({
        where: { id },
        data: {
          currentTurn: currentTurn + 1,
          currentIngameDate: lastEventDate,
          lastPlay: new Date(),
        } as any,
      });

      // Collect border changes for response
      const borderChangesResponse = aiResponse.borderChanges && Array.isArray(aiResponse.borderChanges)
        ? aiResponse.borderChanges.map((bc: any) => ({
            from: bc.from,
            to: bc.to || null,
            description: bc.description || null,
          }))
        : null;

      // Return success response
      return {
        events: createdEvents.map((e: any, index: number) => {
          const chatInfo = eventChatMap.get(index);
          return {
            id: e.id,
            date: e.date,
            summary: e.resume,
            description: e.text,
            chatInitiated: e.chatInitiated !== undefined ? e.chatInitiated : false,
            chatContent: e.chatContent !== undefined ? e.chatContent : null,
            countryInvolved: chatInfo ? chatInfo.countryNames : (e.chatInitiated ? (e.countryInvolved || []) : null),
            chatId: chatInfo ? chatInfo.chatId : (e.chatInitiated ? null : null),
          };
        }),
        updatedGauges: {
          economy: aiResponse.updatedGauges.economy,
          power: aiResponse.updatedGauges.power,
          popularity: aiResponse.updatedGauges.popularity,
        },
        borderChanges: borderChangesResponse,
        gameOver: aiResponse.gameOver || false,
      };
    });

    // 21. Generate reactions (EN DEHORS DE LA TRANSACTION - appel IA)
    try {
      console.log(`🔄 Début génération des réactions pour le tour ${currentTurn + 1}...`);
      const reactionsResult = await generateReactions(
        id,
        (game as any).presetId as string,
        ((game as any).currentIngameDate as string) || '',
        aiResponse.events,
        userActionsFormatted,
        selectedCountry,
        gameDifficulty,
        result.events.length > 0 ? result.events[result.events.length - 1].date : ((game as any).currentIngameDate as string) || '',
        currentTurn + 1, // Nouveau tour
        (game as any).trame as string || '' // Trame du jeu
      );
      console.log(`✅ ${reactionsResult.count} réactions générées pour le tour ${currentTurn + 1}`);
    } catch (reactionsError: any) {
      console.error('⚠️  Erreur lors de la génération des réactions (non bloquant):', reactionsError.message);
      console.error('⚠️  Stack trace:', reactionsError.stack);
      // Ne pas bloquer la réponse si la génération de réactions échoue
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in move-forward:', error);
    
    if (error.message === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (error.message === 'Unauthorized: not the game owner') {
      return res.status(403).json({ error: 'Unauthorized: not the game owner' });
    }

    if (error.message === 'Game is over') {
      return res.status(400).json({ error: 'Game is over' });
    }

    if (error.message === 'Game has no preset') {
      return res.status(404).json({ error: 'Game has no preset' });
    }

    if (error.message === 'Preset not found') {
      return res.status(404).json({ error: 'Preset not found' });
    }

    if (error.message === 'No countries found in game') {
      return res.status(400).json({ error: 'No countries found in game' });
    }

    res.status(500).json({
      error: 'Failed to process move-forward',
      message: error.message,
    });
  }
});

// POST /games/:id/country-chat
router.post('/:id/country-chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { countryIds } = req.body;
    const mockUserId = req.headers['x-user-id'] as string | undefined; // Optionnel pour les mécanismes internes

    // Validation : countryIds doit être un tableau avec 1 à 5 pays
    // 1 pays = chat 1-à-1 avec l'utilisateur
    // 2-5 pays = chat multi-participants avec l'utilisateur
    if (!Array.isArray(countryIds)) {
      return res.status(400).json({ error: 'countryIds must be an array' });
    }

    if (countryIds.length < 1 || countryIds.length > 5) {
      return res.status(400).json({ 
        error: 'countryIds must contain between 1 and 5 countries' 
      });
    }

    // Vérifier que tous les IDs sont des strings valides
    if (!countryIds.every((id: any) => typeof id === 'string' && id.trim() !== '')) {
      return res.status(400).json({ error: 'All countryIds must be valid strings' });
    }

    // Vérifier que la game existe
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        gameOver: true,
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // Si userId est fourni, vérifier que c'est le propriétaire de la game
    if (mockUserId && game.userId !== mockUserId) {
      return res.status(403).json({ error: 'Forbidden: You are not the owner of this game' });
    }

    // Vérifier que tous les pays existent dans game_countries pour cette game
    const uniqueCountryIds = [...new Set(countryIds)]; // Supprimer les doublons
    if (uniqueCountryIds.length !== countryIds.length) {
      return res.status(400).json({ error: 'Duplicate countryIds are not allowed' });
    }

    const gameCountries = await prisma.gameCountry.findMany({
      where: {
        id: { in: uniqueCountryIds },
        gameId: id,
      },
      select: {
        id: true,
        name: true,
        svgId: true,
      },
    });

    if (gameCountries.length !== uniqueCountryIds.length) {
      const foundIds = gameCountries.map(c => c.id);
      const missingIds = uniqueCountryIds.filter(id => !foundIds.includes(id));
      return res.status(404).json({ 
        error: 'Some countries not found in this game',
        missingCountryIds: missingIds,
      });
    }

    // Créer le chat diplomatique avec les pays associés
    const countryChat = await prisma.$transaction(async (tx) => {
      // Créer le CountryChat
      const chat = await tx.countryChat.create({
        data: {
          gameId: id,
          globalTrame: '',
          currentTurnContext: '',
        },
      });

      // Créer les CountryChatCountry pour chaque pays
      await Promise.all(
        gameCountries.map((country) =>
          (tx as any).countryChatCountry.create({
            data: {
              chatId: chat.id,
              countryId: country.id,
              countryTrame: '',
            },
          })
        )
      );

      // Récupérer le chat avec les pays associés
      const createdChat = await tx.countryChat.findUnique({
        where: { id: chat.id },
        include: {
          countries: {
            include: {
              country: {
                select: {
                  id: true,
                  name: true,
                  svgId: true,
                  color: true,
                  independant: true,
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!createdChat) {
        throw new Error('Failed to create country chat');
      }

      return createdChat;
    });

    if (!countryChat) {
      return res.status(500).json({ error: 'Failed to create country chat' });
    }

    res.status(201).json({
      id: countryChat.id,
      gameId: countryChat.gameId,
      globalTrame: countryChat.globalTrame,
      currentTurnContext: countryChat.currentTurnContext,
      countries: countryChat.countries.map((cc: any) => ({
        country: cc.country,
        countryTrame: cc.countryTrame,
      })),
      messages: countryChat.messages,
      createdAt: countryChat.updatedAt,
    });
  } catch (error: any) {
    console.error('Error creating country chat:', error);
    res.status(500).json({
      error: 'Failed to create country chat',
      message: error.message,
    });
  }
});

// POST /games/:id/country-chat/:chatId/send-message
router.post('/:id/country-chat/:chatId/send-message', async (req: Request, res: Response) => {
  try {
    const { id: gameId, chatId } = req.params;
    const { message } = req.body;
    const mockUserId = req.headers['x-user-id'] as string;

    // Validation : x-user-id est obligatoire (utilisateur uniquement)
    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized: x-user-id header is required' });
    }

    // Validation : message est requis et non vide
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message is required and must be a non-empty string' });
    }

    // Sanitization : limiter la longueur du message
    const sanitizedMessage = message.trim().substring(0, 2000);

    // Vérifier que la game existe et que l'utilisateur est propriétaire
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        userId: true,
        gameOver: true,
        currentIngameDate: true,
        selectedCountryId: true,
        presetId: true,
        trame: true,
        money: true,
        power: true,
        popularity: true,
        difficulty: true,
      } as any,
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if ((game as any).userId !== mockUserId) {
      return res.status(403).json({ error: 'Forbidden: You are not the owner of this game' });
    }

    if (game.gameOver) {
      return res.status(400).json({ error: 'Game is over' });
    }

    // Vérifier que le chat existe et appartient à la game, avec les pays associés
    const countryChat = await prisma.countryChat.findFirst({
      where: {
        id: chatId,
        gameId: gameId,
      },
      include: {
        countries: {
          include: {
            country: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!countryChat) {
      return res.status(404).json({ error: 'Country chat not found or does not belong to this game' });
    }

    // Récupérer le nom du pays sélectionné par l'utilisateur
    let countryName = 'USER'; // Par défaut
    let selectedCountryName: string | null = null;
    if ((game as any).selectedCountryId) {
      const selectedPresetCountry = await prisma.presetCountry.findUnique({
        where: { id: (game as any).selectedCountryId },
        select: { name: true } as any,
      });
      if (selectedPresetCountry) {
        countryName = (selectedPresetCountry as any).name;
        selectedCountryName = (selectedPresetCountry as any).name;
      }
    }

    // Récupérer la date in-game
    const currentIngameDate = (game as any).currentIngameDate as string | null;

    // Créer le message utilisateur
    const createdMessage = await prisma.countryMessage.create({
      data: {
        chatId: chatId,
        gameId: gameId,
        userId: mockUserId,
        countryName: countryName,
        content: sanitizedMessage,
        ingameDate: currentIngameDate,
        tokenCost: 0, // Message utilisateur = 0 tokens
        react: null,
      },
    });

    // Vérifier si c'est le premier message de la conversation (seulement le message utilisateur)
    const isFirstMessage = countryChat.messages.length === 0;

    const generatedMessages: any[] = [];

    // Récupérer les pays du chat (excluant le pays de l'utilisateur)
    const chatCountries = countryChat.countries.filter(
      (cc: any) => !cc.countryTrame.includes('[LEFT:') && cc.country.name !== selectedCountryName
    );

    // Pour un chat à 2 participants (1 pays) : toujours générer une réponse automatique
    // Pour un chat multi-participants : générer les réponses à chaque message
    const shouldGenerateAutoResponses = chatCountries.length >= 1;

    // Générer les réponses automatiques si nécessaire
    if (shouldGenerateAutoResponses) {

      // Récupérer les données nécessaires pour l'appel IA
      const presetId = (game as any).presetId as string | null;
      if (!presetId) {
        return res.status(400).json({ error: 'Game has no preset' });
      }

      const preset = await prisma.preset.findUnique({
        where: { id: presetId },
        select: {
          chatPrompt: true,
          lore: true,
        },
      });

      if (!preset) {
        return res.status(404).json({ error: 'Preset not found' });
      }

      // Charger le prompt de difficulté
      const gameDifficulty = (game as any).difficulty as string;
      const difficultyPromptPath = path.join(__dirname, '../../difficulty', `${gameDifficulty}.txt`);
      let difficultyPrompt = '';
      try {
        if (fs.existsSync(difficultyPromptPath)) {
          difficultyPrompt = fs.readFileSync(difficultyPromptPath, 'utf-8').trim();
        }
      } catch (error) {
        console.warn(`⚠️  Impossible de lire le fichier de difficulté: ${difficultyPromptPath}`);
      }

      // Récupérer les gauges du pays utilisateur
      const userGauges = {
        economy: (game as any).money as number,
        power: (game as any).power as number,
        popularity: (game as any).popularity as number,
      };

      // Récupérer la trame de la game
      const gameTrame = (game as any).trame as string || '';

      // Construire l'historique des messages (incluant tous les messages précédents + le nouveau message utilisateur)
      const existingMessages = countryChat.messages.map((msg: any) => ({
        userId: msg.userId || null,
        countryName: msg.countryName || null,
        content: msg.content || '',
        ingameDate: msg.ingameDate || currentIngameDate,
      }));

      const messagesHistory = [
        ...existingMessages,
        {
          userId: mockUserId,
          countryName: countryName,
          content: sanitizedMessage,
          ingameDate: currentIngameDate,
        },
      ];

      // Si chat à 2 participants (1 pays) : une seule réponse
      if (chatCountries.length === 1) {
        const chatCountry = chatCountries[0];
        const actingCountry = {
          name: chatCountry.country.name,
          independant: chatCountry.country.independant,
          ownedBy: chatCountry.country.ownedBy,
          surname: chatCountry.country.surname,
        };

        // Construire targetCountries (incluant le pays utilisateur)
        const targetCountries: any[] = [];
        if (selectedCountryName) {
          targetCountries.push({
            name: selectedCountryName,
            gauges: {
              power: userGauges.power,
              economy: userGauges.economy,
              relationship: 50, // Par défaut
            },
          });
        }

        // Appeler l'API interne request-message
        try {
          const requestBody = {
            trame: gameTrame,
            messages: messagesHistory,
            gauges: userGauges,
            chatPrompt: preset.chatPrompt,
            difficulty: gameDifficulty,
            difficultyPrompt: difficultyPrompt,
            actingCountry: actingCountry,
            targetCountries: targetCountries,
            ingameDate: currentIngameDate,
            lore: preset.lore || '',
          };

          const aiData = await generateCountryMessageAI(
            gameId,
            chatId,
            gameTrame,
            messagesHistory,
            userGauges,
            preset.chatPrompt,
            gameDifficulty,
            difficultyPrompt,
            actingCountry,
            targetCountries,
            currentIngameDate,
            preset.lore || ''
          );

          if (aiData) {
            // Persister le message IA
            const aiMessage = await prisma.countryMessage.create({
              data: {
                chatId: chatId,
                gameId: gameId,
                userId: null,
                countryName: actingCountry.name,
                content: aiData.message,
                ingameDate: currentIngameDate,
                tokenCost: Math.ceil(aiData.message.length / 4), // Estimation
                react: null,
              },
            });

            generatedMessages.push({
              id: aiMessage.id,
              content: aiMessage.content,
              countryName: aiMessage.countryName,
              ingameDate: aiMessage.ingameDate,
              createdAt: aiMessage.createdAt,
            });

            // Gérer leaveAfterTalking si nécessaire
            if (aiData.leaveAfterTalking === true) {
              const leaveDate = aiData.leaveDate || currentIngameDate || 'N/A';
              const existingTrame = chatCountry.countryTrame || '';
              const updatedTrame = existingTrame 
                ? `${existingTrame} [LEFT:${leaveDate}]`
                : `[LEFT:${leaveDate}]`;
              
              await (prisma as any).countryChatCountry.updateMany({
                where: {
                  chatId: chatId,
                  countryId: chatCountry.countryId,
                },
                data: {
                  countryTrame: updatedTrame,
                },
              });
            }
          }
        } catch (error: any) {
          console.error('Error generating AI response:', error);
          // Ne pas échouer la requête si l'IA échoue
        }
      } 
      // Si chat à plusieurs participants : réponses séquentielles
      else if (chatCountries.length > 1) {
        // Faire répondre chaque pays un par un
        for (const chatCountry of chatCountries) {
          const actingCountry = {
            name: chatCountry.country.name,
            independant: chatCountry.country.independant,
            ownedBy: chatCountry.country.ownedBy,
            surname: chatCountry.country.surname,
          };

          // Construire targetCountries (tous les autres pays + le pays utilisateur)
          const targetCountries: any[] = [];
          
          // Ajouter le pays utilisateur
          if (selectedCountryName) {
            targetCountries.push({
              name: selectedCountryName,
              gauges: {
                power: userGauges.power,
                economy: userGauges.economy,
                relationship: 50,
              },
            });
          }

          // Ajouter les autres pays du chat (excluant celui qui parle)
          for (const otherCountry of chatCountries) {
            if (otherCountry.countryId !== chatCountry.countryId) {
              const gameCountry = await prisma.gameCountry.findUnique({
                where: { id: otherCountry.countryId },
                select: { power: true, economy: true } as any,
              });

              targetCountries.push({
                name: otherCountry.country.name,
                gauges: {
                  power: gameCountry?.power || 50,
                  economy: gameCountry?.economy || 50,
                  relationship: 50,
                },
              });
            }
          }

          // Recharger les messages avant chaque appel pour inclure les réponses précédentes
          const currentMessages = await prisma.countryMessage.findMany({
            where: { chatId: chatId },
            orderBy: { createdAt: 'asc' },
            select: {
              userId: true,
              countryName: true,
              content: true,
              ingameDate: true,
            },
          });

          const messagesHistoryForAI = currentMessages.map((msg: any) => ({
            userId: msg.userId,
            countryName: msg.countryName,
            content: msg.content,
            ingameDate: msg.ingameDate,
          }));

          // Appeler l'API interne request-message
          try {
            const requestBody = {
              trame: gameTrame,
              messages: messagesHistoryForAI,
              gauges: userGauges,
              chatPrompt: preset.chatPrompt,
              difficulty: gameDifficulty,
              difficultyPrompt: difficultyPrompt,
              actingCountry: actingCountry,
              targetCountries: targetCountries,
              ingameDate: currentIngameDate,
              lore: preset.lore || '',
            };

            const aiData = await generateCountryMessageAI(
              gameId,
              chatId,
              gameTrame,
              messagesHistoryForAI,
              userGauges,
              preset.chatPrompt,
              gameDifficulty,
              difficultyPrompt,
              actingCountry,
              targetCountries,
              currentIngameDate,
              preset.lore || ''
            );

            if (aiData) {
              // Persister le message IA
              const aiMessage = await prisma.countryMessage.create({
                data: {
                  chatId: chatId,
                  gameId: gameId,
                  userId: null,
                  countryName: actingCountry.name,
                  content: aiData.message,
                  ingameDate: currentIngameDate,
                  tokenCost: Math.ceil(aiData.message.length / 4), // Estimation
                  react: null,
                },
              });

              generatedMessages.push({
                id: aiMessage.id,
                content: aiMessage.content,
                countryName: aiMessage.countryName,
                ingameDate: aiMessage.ingameDate,
                createdAt: aiMessage.createdAt,
              });

              // Gérer leaveAfterTalking si nécessaire
              if (aiData.leaveAfterTalking === true) {
                const leaveDate = aiData.leaveDate || currentIngameDate || 'N/A';
                const existingTrame = chatCountry.countryTrame || '';
                const updatedTrame = existingTrame 
                  ? `${existingTrame} [LEFT:${leaveDate}]`
                  : `[LEFT:${leaveDate}]`;
                
                await (prisma as any).countryChatCountry.updateMany({
                  where: {
                    chatId: chatId,
                    countryId: chatCountry.countryId,
                  },
                  data: {
                    countryTrame: updatedTrame,
                  },
                });
              }
            }
          } catch (error: any) {
            console.error(`Error generating AI response for ${actingCountry.name}:`, error);
            // Continuer avec le pays suivant même si celui-ci échoue
          }
        }
      }
    }

    res.status(201).json({
      message: {
        id: createdMessage.id,
        chatId: createdMessage.chatId,
        gameId: createdMessage.gameId,
        userId: createdMessage.userId,
        countryName: createdMessage.countryName,
        content: createdMessage.content,
        ingameDate: createdMessage.ingameDate,
        tokenCost: createdMessage.tokenCost,
        react: createdMessage.react,
        createdAt: createdMessage.createdAt,
      },
      generatedMessages: generatedMessages,
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message,
    });
  }
});

// POST /games/:id/country-chat/:chatId/request-message (INTERNE)
// API interne pour demander un message à l'IA
router.post('/:id/country-chat/:chatId/request-message', async (req: Request, res: Response) => {
  try {
    const { id: gameId, chatId } = req.params;
    const {
      trame,
      messages,
      gauges,
      chatPrompt,
      difficulty,
      difficultyPrompt,
      actingCountry,
      targetCountries,
      ingameDate,
      lore,
      underlyingPressures,
    } = req.body;

    // Validation des paramètres requis
    if (!trame || typeof trame !== 'string') {
      return res.status(400).json({ error: 'trame is required and must be a string' });
    }

    if (!gauges || typeof gauges !== 'object') {
      return res.status(400).json({ error: 'gauges is required and must be an object' });
    }

    if (!chatPrompt || typeof chatPrompt !== 'string') {
      return res.status(400).json({ error: 'chatPrompt is required and must be a string' });
    }

    if (!difficulty || typeof difficulty !== 'string') {
      return res.status(400).json({ error: 'difficulty is required and must be a string' });
    }

    if (!actingCountry || typeof actingCountry !== 'object' || !actingCountry.name) {
      return res.status(400).json({ error: 'actingCountry is required and must be an object with a name property' });
    }

    if (!Array.isArray(targetCountries)) {
      return res.status(400).json({ error: 'targetCountries is required and must be an array' });
    }

    // Vérifier que le chat existe et appartient à la game (validation minimale)
    const countryChat = await prisma.countryChat.findFirst({
      where: {
        id: chatId,
        gameId: gameId,
      },
    });

    if (!countryChat) {
      return res.status(404).json({ error: 'Country chat not found or does not belong to this game' });
    }

    // Construire le contexte JSON pour l'IA
    const contextJson: any = {
      difficulty: difficulty,
      lore: lore || '',
      trame: trame,
      ingameDate: ingameDate || null,
      actingCountry: actingCountry,
      targetCountries: targetCountries,
    };

    // Ajouter les messages passés si fournis
    if (messages && Array.isArray(messages)) {
      contextJson.currentChatHistory = messages.map((msg: any) => ({
        speaker: msg.userId ? 'USER' : 'COUNTRY',
        country: msg.countryName || null,
        message: msg.content || msg.message || '',
        date: msg.ingameDate || ingameDate || null,
      }));
    }

    // Ajouter underlyingPressures si fourni
    if (underlyingPressures && typeof underlyingPressures === 'string' && underlyingPressures.trim() !== '') {
      contextJson.underlyingPressures = underlyingPressures.trim();
    }

    // Construire le prompt système avec la difficulté
    // Le chatPrompt contient déjà les instructions de format JSON, on ajoute juste la difficulté
    const systemPrompt = `You must know that the player is playing on difficulty: ${difficulty}
${difficultyPrompt ? `\n${difficultyPrompt}` : ''}

${chatPrompt}

CRITICAL OUTPUT REQUIREMENT: You must respond ONLY with a valid JSON object in this exact format:
{
  "message": "your diplomatic response text here",
  "leaveAfterTalking": false,
  "leaveDate": null
}

Do not include any text before or after the JSON. Do not use markdown code blocks. Return only the raw JSON object.`;

    // Construire les messages pour l'IA
    const messagesForAI: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CONTEXT:\n${JSON.stringify(contextJson, null, 2)}` },
    ];

    // Appeler l'IA avec retry logic
    let aiResponse: any = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const groqResponse = await callGroq(messagesForAI);
        const content = groqResponse.content.trim();

        // Extraire le JSON de la réponse
        let jsonContent = content;
        
        // Essayer d'extraire depuis un bloc de code markdown
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        } else {
          const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeMatch) {
            jsonContent = codeMatch[1];
          } else {
            // Essayer de trouver un objet JSON dans le texte (chercher le premier { et le dernier })
            const firstBrace = content.indexOf('{');
            if (firstBrace !== -1) {
              // Trouver le dernier } qui correspond au premier {
              let braceCount = 0;
              let lastBrace = -1;
              for (let i = firstBrace; i < content.length; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastBrace = i;
                    break;
                  }
                }
              }
              if (lastBrace !== -1) {
                jsonContent = content.substring(firstBrace, lastBrace + 1);
              }
            }
          }
        }

        // Nettoyer le contenu JSON (supprimer les espaces en début/fin)
        jsonContent = jsonContent.trim();

        aiResponse = JSON.parse(jsonContent);

        // Validation de la réponse IA
        if (!aiResponse.message || typeof aiResponse.message !== 'string') {
          throw new Error('Invalid AI response: message is required and must be a string');
        }

        if (typeof aiResponse.leaveAfterTalking !== 'boolean') {
          throw new Error('Invalid AI response: leaveAfterTalking must be a boolean');
        }

        if (aiResponse.leaveDate !== null && typeof aiResponse.leaveDate !== 'string') {
          throw new Error('Invalid AI response: leaveDate must be null or a string');
        }

        // Sanitization du message
        aiResponse.message = aiResponse.message.trim().substring(0, 2000);

        // Validation réussie
        break;
      } catch (error: any) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to get valid AI response after ${maxRetries} attempts: ${error.message}`);
        }
        console.warn(`⚠️  Tentative ${retryCount} échouée, retry...`);
      }
    }

    // Retourner la réponse
    res.status(200).json({
      message: aiResponse.message,
      leaveAfterTalking: aiResponse.leaveAfterTalking,
      leaveDate: aiResponse.leaveDate,
    });
  } catch (error: any) {
    console.error('Error requesting AI message:', error);
    res.status(500).json({
      error: 'Failed to request AI message',
      message: error.message,
    });
  }
});

// GET /games/:id/reactions
// Récupère les réactions (tweets ou messages de taverne) pour un tour donné
router.get('/:id/reactions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { turn } = req.query;

    // Vérifier que la game existe
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        currentTurn: true,
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Si turn n'est pas spécifié, utiliser le tour actuel
    const targetTurn = turn ? parseInt(String(turn)) : game.currentTurn;

    // Récupérer les réactions pour ce tour
    const reactions = await (prisma as any).reaction.findMany({
      where: {
        gameId: id,
        turn: targetTurn,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json({
      turn: targetTurn,
      reactions: reactions,
    });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

export default router;

