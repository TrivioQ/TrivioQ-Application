import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';

import userRoutes from './routes/user';
import dropRoutes from './routes/drop';
import leaderboardRoutes from './routes/leaderboard';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';

import { env } from './config/env';

const app = express();
const port = env.PORT;

app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/drops', dropRoutes);
app.use('/api/v1/leaderboards', leaderboardRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Simple db query to check if DB connection is alive
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: String(error),
    });
  }
});

// Example route using shared-types to verify compilation
app.post('/preferences', (req: Request, res: Response) => {
  const prefs: UserPreferences = req.body;
  res.json({ received: prefs });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
