import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import healthRoutes from './routes/health';
import presetRoutes from './routes/presets';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/presets', presetRoutes);
app.use('/users', userRoutes);
app.use('/games', gameRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

