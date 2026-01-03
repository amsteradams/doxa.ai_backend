import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /presets
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('📥 GET /presets - Début de la requête');
    
    // Vérifier que Prisma est initialisé
    if (!prisma) {
      console.error('❌ Prisma client non initialisé');
      return res.status(500).json({ 
        error: 'Database client not initialized',
        details: 'Prisma client is null or undefined'
      });
    }

    console.log('🔍 Tentative de connexion à la base de données...');
    const presets = await prisma.preset.findMany({
      select: {
        id: true,
        hasProvinces: true,
        playedCount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ ${presets.length} preset(s) trouvé(s)`);
    res.json(presets);
  } catch (error: any) {
    console.error('❌ Error fetching presets:', error);
    console.error('   Error name:', error?.name);
    console.error('   Error message:', error?.message);
    console.error('   Error code:', error?.code);
    console.error('   Error stack:', error?.stack);

    // Erreurs Prisma spécifiques
    if (error?.code === 'P1001') {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: 'Cannot reach database server',
        code: error.code,
        message: error.message,
        hint: 'Check DATABASE_URL and ensure database is accessible'
      });
    }

    if (error?.code === 'P1000') {
      return res.status(500).json({ 
        error: 'Database authentication failed',
        details: 'Invalid database credentials',
        code: error.code,
        message: error.message,
        hint: 'Check DATABASE_URL username and password'
      });
    }

    if (error?.code === 'P1017') {
      return res.status(500).json({ 
        error: 'Database connection closed',
        details: 'Server has closed the connection',
        code: error.code,
        message: error.message,
        hint: 'Database server may be restarting or unavailable'
      });
    }

    if (error?.code === 'P2002') {
      return res.status(500).json({ 
        error: 'Database constraint violation',
        details: 'Unique constraint failed',
        code: error.code,
        message: error.message
      });
    }

    // Erreur générique avec détails
    return res.status(500).json({ 
      error: 'Failed to fetch presets',
      details: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN',
      type: error?.name || 'Error',
      ...(process.env.NODE_ENV === 'development' && { stack: error?.stack })
    });
  }
});

// GET /presets/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /presets/${id} - Début de la requête`);

    if (!id) {
      return res.status(400).json({ 
        error: 'Invalid preset ID',
        details: 'Preset ID is required'
      });
    }

    // Vérifier que Prisma est initialisé
    if (!prisma) {
      console.error('❌ Prisma client non initialisé');
      return res.status(500).json({ 
        error: 'Database client not initialized',
        details: 'Prisma client is null or undefined'
      });
    }

    console.log(`🔍 Recherche du preset avec ID: ${id}`);
    const preset = await prisma.preset.findUnique({
      where: { id },
      include: {
        presetCountries: {
          select: {
            id: true,
            name: true,
            color: true,
            independant: true,
            ownedBy: true,
            surname: true,
            svgId: true,
          },
        },
      },
    });

    if (!preset) {
      console.log(`⚠️  Preset non trouvé: ${id}`);
      return res.status(404).json({ 
        error: 'Preset not found',
        details: `No preset found with ID: ${id}`,
        id: id
      });
    }

    console.log(`✅ Preset trouvé: ${preset.id} (${preset.presetCountries?.length || 0} pays)`);
    res.json(preset);
  } catch (error: any) {
    console.error(`❌ Error fetching preset ${req.params.id}:`, error);
    console.error('   Error name:', error?.name);
    console.error('   Error message:', error?.message);
    console.error('   Error code:', error?.code);

    // Erreurs Prisma spécifiques
    if (error?.code === 'P1001') {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: 'Cannot reach database server',
        code: error.code,
        message: error.message,
        hint: 'Check DATABASE_URL and ensure database is accessible'
      });
    }

    if (error?.code === 'P1000') {
      return res.status(500).json({ 
        error: 'Database authentication failed',
        details: 'Invalid database credentials',
        code: error.code,
        message: error.message,
        hint: 'Check DATABASE_URL username and password'
      });
    }

    if (error?.code === 'P2025') {
      return res.status(404).json({ 
        error: 'Preset not found',
        details: 'Record does not exist',
        code: error.code,
        id: req.params.id
      });
    }

    // Erreur générique avec détails
    return res.status(500).json({ 
      error: 'Failed to fetch preset',
      details: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN',
      type: error?.name || 'Error',
      id: req.params.id,
      ...(process.env.NODE_ENV === 'development' && { stack: error?.stack })
    });
  }
});

export default router;





