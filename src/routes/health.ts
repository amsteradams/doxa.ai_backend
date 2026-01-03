import { Router, Request, Response } from 'express';
import { callDeepSeek } from '../iaActions/deepseek';
import { callGroq } from '../iaActions/groqChat';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /health-check-db
router.get('/db', async (req: Request, res: Response) => {
  try {
    // Test simple de connexion à la base de données
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in health-check-db:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to connect to database',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health-check-ia
router.get('/health-check-ia', async (req: Request, res: Response) => {
  try {
    const response = await callDeepSeek([
      { role: 'user', content: 'coucou' }
    ]);

    res.json({
      status: 'ok',
      message: 'DeepSeek API is working',
      response: response.content,
      usage: response.usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in health-check-ia:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to connect to DeepSeek API',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health-check-groq
router.get('/health-check-groq', async (req: Request, res: Response) => {
  try {
    const response = await callGroq([
      { role: 'user', content: 'coucou' }
    ]);

    res.json({
      status: 'ok',
      message: 'Groq API is working',
      response: response.content,
      usage: response.usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in health-check-groq:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to connect to Groq API',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
