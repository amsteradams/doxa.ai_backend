import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /presets
router.get('/', async (req: Request, res: Response) => {
  try {
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

    res.json(presets);
  } catch (error) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

// GET /presets/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json(preset);
  } catch (error) {
    console.error('Error fetching preset:', error);
    res.status(500).json({ error: 'Failed to fetch preset' });
  }
});

export default router;





