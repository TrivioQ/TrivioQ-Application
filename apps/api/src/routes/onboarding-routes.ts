import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { scheduleRemainingDropsForUser, executeImmediateDropForUser } from '../services/drop-orchestrator';

const router = express.Router();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const OnboardingCompleteSchema = z.object({
  categoryNames: z.array(z.string().min(1)).min(30),
  activeWindowStart: z.string().regex(timeRegex),
  activeWindowEnd: z.string().regex(timeRegex),
  acceptTrial: z.boolean().refine((v) => v === true, { message: 'Trial acceptance is required.' }),
});

const TRIAL_DAYS = 7;

router.post('/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = OnboardingCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    }
    const { categoryNames, activeWindowStart, activeWindowEnd } = parsed.data;
    const userId = (req as any).userId;

    // Validate every submitted category name exists
    const found = await prisma.category.findMany({
      where: { name: { in: categoryNames } },
      select: { name: true },
    });
    const foundSet = new Set(found.map((c) => c.name));
    const unknown = categoryNames.filter((n) => !foundSet.has(n));
    if (unknown.length > 0) {
      return res.status(400).json({
        error: 'Unknown categories',
        details: { unknown },
      });
    }

    // Equal-weight percentages; sums to exactly 1.0 by construction
    const equalWeight = 1 / categoryNames.length;
    const categoryPercentages: Record<string, number> = {};
    for (const name of categoryNames) categoryPercentages[name] = equalWeight;

    // Convert HH:MM to today's DateTime columns
    const now = new Date();
    const [startHour, startMin] = activeWindowStart.split(':').map(Number);
    const [endHour, endMin] = activeWindowEnd.split(':').map(Number);
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin);

    const trialExpiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // Merge with existing preferences (do NOT clobber difficultyPercentages)
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, currentStreak: true },
    });
    const existingPrefs: any = (existing?.preferences as any) ?? {};
    const mergedPrefs = { ...existingPrefs, categoryPercentages };

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: 'PREMIUM',
          subscriptionExpiresAt: trialExpiresAt,
          onboardingComplete: true,
          activeWindowStart: windowStart,
          activeWindowEnd: windowEnd,
          preferences: mergedPrefs,
        } as any,
        select: {
          id: true,
          subscriptionTier: true,
          subscriptionExpiresAt: true,
          onboardingComplete: true,
        } as any,
      }),
      prisma.userSubscriptionHistory.create({
        data: {
          userId,
          tier: 'PREMIUM',
          source: 'TRIAL',
          startedAt: now,
          expiresAt: trialExpiresAt,
        } as any,
      }),
    ]);

    // After commit (not inside txn): enqueue remaining drops + run immediate drop synchronously.
    try {
      await scheduleRemainingDropsForUser(userId, { now });
    } catch (err) {
      console.error('[onboarding/complete] scheduleRemainingDropsForUser failed:', err);
    }

    let firstDropScheduledAt = now.toISOString();
    try {
      const { dropId } = await executeImmediateDropForUser(userId, now);
      if (!dropId) firstDropScheduledAt = '';
    } catch (err) {
      console.error('[onboarding/complete] executeImmediateDropForUser failed:', err);
      firstDropScheduledAt = '';
    }

    return res.status(200).json({
      onboardingComplete: (updatedUser as any).onboardingComplete,
      tierAfter: updatedUser.subscriptionTier,
      trialExpiresAt: updatedUser.subscriptionExpiresAt,
      firstDropScheduledAt,
    });
  } catch (error) {
    console.error('[onboarding/complete] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
