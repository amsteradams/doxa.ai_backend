import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /me (mock) - Doit être avant /:id pour éviter les conflits
router.get('/me', async (req: Request, res: Response) => {
  try {
    // TODO: Récupérer l'utilisateur depuis le token JWT
    // Pour l'instant, on retourne un mock
    const mockUserId = req.headers['x-user-id'] as string;

    if (!mockUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: mockUserId },
      select: {
        id: true,
        username: true,
        userType: true,
        balance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// GET /users/:id (mock)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        userType: true,
        balance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;

