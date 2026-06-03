import './config/env'; // Trigger dev server reload after sync fallback update
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { expressIntegration } from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [expressIntegration(), nodeProfilingIntegration()],
  sendDefaultPii: false,
  beforeSend(event) {
    const sensitiveKeys = ['email', 'firebaseUid', 'password'];
    function scrub(obj: unknown) {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (sensitiveKeys.includes(key)) {
          (obj as Record<string, unknown>)[key] = '[Filtered]';
        } else {
          scrub((obj as Record<string, unknown>)[key]);
        }
      }
    }
    scrub(event);
    return event;
  },
});

import express, { Request, Response } from 'express';
process.env.TZ = 'UTC';
import { prisma } from '@trivioq/database';

import userRoutes from './routes/user';
import dropRoutes from './routes/drop';
import dropLifecycleRoutes from './routes/drop-routes';
import leaderboardRoutes from './routes/leaderboard';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import faqRoutes from './routes/faq';
import legalRoutes from './routes/legal';
import subscriptionRoutes from './routes/subscription-routes';

import { env } from './config/env';
import { getSetting } from './utils/settings';
import { initLeaderboardWorker } from './workers/leaderboard-worker';
import { initAIQuestionWorker } from './workers/ai-question-worker';

const app = express();
const port = env.PORT;

app.use(express.json());

app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/drops', dropRoutes);
app.use('/v1/drops', dropLifecycleRoutes);
app.use('/v1/leaderboards', leaderboardRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/faqs', faqRoutes);
app.use('/v1/legal', legalRoutes);
app.use('/v1/subscriptions', subscriptionRoutes);

app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: String(error) });
  }
});

// Public app metadata — consumed by mobile clients for support contact etc.
app.get('/v1/info', async (req: Request, res: Response) => {
  try {
    const supportEmail = await getSetting('support_email', 'support@trivioq.com');
    res.json({ supportEmail });
  } catch (error) {
    console.error('Failed to fetch app info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

Sentry.setupExpressErrorHandler(app);

initLeaderboardWorker();
initAIQuestionWorker();

app.listen(Number(port), () => {
  console.log(`API server listening on port ${port}`);
});
