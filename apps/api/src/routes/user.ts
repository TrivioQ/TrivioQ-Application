import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';
import { requireAuth } from '../middleware/firebase-auth';

const router = express.Router();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const UserPreferencesSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  theme: z.enum(['light', 'dark', 'system']),
  notificationsEnabled: z.boolean(),
  language: z.string(),
  categoryPercentages: z.record(z.string(), z.number()).refine(
    (data) => {
      const sum = Object.values(data).reduce((acc: number, val: number) => acc + val, 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: 'Category percentages must add up to 1.0' },
  ),
  difficultyPercentages: z.record(z.string(), z.number()).refine(
    (data) => {
      const sum = Object.values(data).reduce((acc: number, val: number) => acc + val, 0);
      return Math.abs(sum - 100) < 0.1;
    },
    { message: 'Difficulty percentages must add up to 100' },
  ),
  // Accepted from the client to populate the User DateTime columns, but NOT
  // stored in the preferences JSON blob (authoritative source is the DB columns).
  activeWindowStart: z.string().regex(timeRegex, 'Invalid 24h time format'),
  activeWindowEnd: z.string().regex(timeRegex, 'Invalid 24h time format'),
  targetDropsPerWeek: z.number().min(1).max(100).default(35),
});

router.put('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    // Parse the full body (includes activeWindowStart/End for DB column writes)
    const raw = UserPreferencesSchema.parse(req.body);
    const userId = (req as any).userId;

    // Convert "HH:MM" strings to DateTime for the typed User columns
    const now = new Date();
    const [startHour, startMin] = raw.activeWindowStart.split(':').map(Number);
    const [endHour, endMin] = raw.activeWindowEnd.split(':').map(Number);

    const activeWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
    const activeWindowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin);

    // Strip the window fields before writing to the JSON blob — the DB columns
    // are the authoritative source; storing them twice causes drift.
    const { activeWindowStart: _s, activeWindowEnd: _e, ...preferencesBlob } = raw;
    const payload = preferencesBlob as UserPreferences;

    // Upsert preferences into the database
    const updatedUser = await prisma.user.upsert({
      where: { id: userId },
      update: {
        activeWindowStart,
        activeWindowEnd,
        displayName: payload.displayName,
        preferences: payload as any,
      },
      create: {
        id: userId,
        firebaseUid: `mock_${userId}`,
        email: `mock_${userId}@example.com`,
        username: `user_${userId}`,
        displayName: payload.displayName || `user_${userId}`,
        activeWindowStart,
        activeWindowEnd,
        preferences: payload as any,
      },
    });

    res.json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to update preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        currentStreak: true,
        cumulativeScore: true,
        subscriptionTier: true,
        preferences: true,
        // Returned as ISO strings; clients convert to HH:MM for display
        activeWindowStart: true,
        activeWindowEnd: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/me/score-history?period=weekly|monthly
// Returns the last 12 months of score periods for the authenticated user.
router.get('/me/score-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const period = (req.query.period as string) || 'weekly';

    if (period !== 'weekly' && period !== 'monthly') {
      return res.status(400).json({ error: 'Invalid period. Use weekly or monthly.' });
    }

    const periodType = period === 'weekly' ? 'WEEKLY' : 'MONTHLY';
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const scores = await prisma.userScore.findMany({
      where: {
        userId,
        periodType,
        periodStart: { gte: twelveMonthsAgo },
      },
      orderBy: { periodStart: 'desc' },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        baseScore: true,
        bonusScore: true,
        totalScore: true,
        rank: true,
      },
    });

    res.json({ history: scores });
  } catch (error) {
    console.error('Failed to fetch score history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/me/recent-drops
// Returns the last 10 answered drops for the authenticated user.
router.get('/me/recent-drops', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const drops = await prisma.userDrop.findMany({
      where: { userId, isAnswered: true },
      orderBy: { answeredAt: 'desc' },
      take: 10,
      select: {
        id: true,
        wasCorrect: true,
        pointsAwarded: true,
        usedHint: true,
        hintCostDeducted: true,
        revealedAnswer: true,
        selectedChoiceId: true,
        answeredAt: true,
        question: {
          select: {
            questionText: true,
            difficultyLevel: true,
            categories: { select: { name: true } },
            choices: {
              select: { id: true, text: true, order: true, isCorrect: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    res.json({ drops });
  } catch (error) {
    console.error('Failed to fetch recent drops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
