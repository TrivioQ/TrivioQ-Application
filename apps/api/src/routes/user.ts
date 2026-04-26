import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';
import { requireAuth } from '../middleware/firebaseAuth';

const router = express.Router();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  notificationsEnabled: z.boolean(),
  language: z.string(),
  categoryPercentages: z.record(z.string(), z.number()).refine(
    (data) => {
      const sum = Object.values(data).reduce((acc: number, val: number) => acc + val, 0);
      return Math.abs(sum - 1.0) < 0.001; // Handle floating point precision
    },
    { message: 'Percentages must add up to 1.0' },
  ),
  activeWindowStart: z.string().regex(timeRegex, 'Invalid 24h time format'),
  activeWindowEnd: z.string().regex(timeRegex, 'Invalid 24h time format'),
});

router.put('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = UserPreferencesSchema.parse(req.body) as UserPreferences;
    const userId = (req as any).userId;

    // Convert "HH:MM" to a generic DateTime for the User model
    const now = new Date();
    const [startHour, startMin] = payload.activeWindowStart.split(':').map(Number);
    const [endHour, endMin] = payload.activeWindowEnd.split(':').map(Number);

    const activeWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
    const activeWindowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin);

    // Upsert preferences into the database
    const updatedUser = await prisma.user.upsert({
      where: { id: userId },
      update: {
        activeWindowStart,
        activeWindowEnd,
        preferences: payload as any,
      },
      create: {
        id: userId,
        firebaseUid: `mock_${userId}`, // Dummy value for mock
        email: `mock_${userId}@example.com`, // Dummy value for mock
        username: `user_${userId}`, // Dummy username for the mock
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
        currentStreak: true,
        cumulativeScore: true,
        subscriptionTier: true,
        preferences: true,
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

export default router;
