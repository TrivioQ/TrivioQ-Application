import express, { Request, Response } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { UserPreferences } from '@trivioq/shared-types';
import { addDays, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const router = express.Router();

function resolveTimezone(preferences: unknown): string {
  return (preferences as any)?.timezone ?? 'UTC';
}

// ── GET /subscriptions/status ─────────────────────────────────────────────────
// Returns the caller's subscription state, vault expiry, and token balance.
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        onDemandTokens: true,
        preferences: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const timezone = resolveTimezone(user.preferences);

    // PLUS is time-limited; treat as FREE if the window has passed
    let currentStatus: 'PREMIUM' | 'PLUS' | 'FREE';
    if (user.subscriptionTier === 'PREMIUM') {
      currentStatus = 'PREMIUM';
    } else if (user.subscriptionTier === 'PLUS' && user.subscriptionExpiresAt != null && user.subscriptionExpiresAt > now) {
      currentStatus = 'PLUS';
    } else {
      currentStatus = 'FREE';
    }

    return res.status(200).json({
      currentStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
      onDemandTokensAvailable: user.onDemandTokens,
      userTimezone: timezone,
    });
  } catch (error) {
    console.error('[subscriptions/status] Failed to fetch subscription status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /subscriptions/activate-vault ───────────────────────────────────────
// Burns onDemandTokens to extend the on-demand vault.
// Expiry snaps to 23:59:59 of the final active day in the user's local timezone.
const ActivateVaultSchema = z.object({
  daysToActivate: z.number().int().min(1),
});

router.post('/activate-vault', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const parsed = ActivateVaultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.format() });
    }
    const { daysToActivate } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        onDemandTokens: true,
        subscriptionExpiresAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.onDemandTokens < daysToActivate) {
      return res.status(402).json({
        error: 'Insufficient on-demand tokens',
        available: user.onDemandTokens,
        required: daysToActivate,
      });
    }

    const timezone = resolveTimezone(user.preferences);
    const now = new Date();

    // Extend from existing expiry if PLUS vault is still active, otherwise start from today
    const plusActive = user.subscriptionTier === 'PLUS' && user.subscriptionExpiresAt != null && user.subscriptionExpiresAt > now;
    const baseDate = plusActive ? user.subscriptionExpiresAt! : now;

    // Convert base to the user's local timezone, advance by daysToActivate, then
    // snap to 23:59:59.999 of that final local day before converting back to UTC.
    const zonedBase = toZonedTime(baseDate, timezone);
    const zonedFinalDay = addDays(zonedBase, daysToActivate);
    const zonedEndOfDay = endOfDay(zonedFinalDay);
    const utcExpiry = fromZonedTime(zonedEndOfDay, timezone);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        onDemandTokens: { decrement: daysToActivate },
        subscriptionTier: 'PLUS',
        subscriptionExpiresAt: utcExpiry,
      },
      select: {
        onDemandTokens: true,
        subscriptionExpiresAt: true,
      },
    });

    return res.status(200).json({
      subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
      onDemandTokensRemaining: updatedUser.onDemandTokens,
    });
  } catch (error) {
    console.error('[subscriptions/activate-vault] Failed to activate vault:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// ── Referral Hook ─────────────────────────────────────────────────────────────
// Call after any action that may have changed currentStreak.
// Awards 1 on-demand token to the referrer when the referred user hits streak 3.
export async function checkReferralStreak(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentStreak: true, referredById: true },
  });

  if (!user || user.currentStreak !== 3 || !user.referredById) {
    return;
  }

  const referrer = await prisma.user.update({
    where: { id: user.referredById },
    data: { onDemandTokens: { increment: 1 } },
    select: { id: true, devicePushToken: true, onDemandTokens: true },
  });

  if (!referrer.devicePushToken) {
    return;
  }

  const message: admin.messaging.Message = {
    notification: {
      title: 'Referral Reward!',
      body: 'Someone you referred just hit a 3-day streak. You earned 1 on-demand token!',
    },
    data: {
      type: 'REFERRAL_REWARD',
      newTokenBalance: referrer.onDemandTokens.toString(),
    },
    token: referrer.devicePushToken,
  };

  try {
    await admin.messaging().send(message);
  } catch (error: any) {
    console.error(`[checkReferralStreak] FCM failed for referrer ${referrer.id}:`, error);
    if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
      await prisma.user.update({
        where: { id: referrer.id },
        data: { devicePushToken: null },
      });
    }
    // Non-fatal — token was already awarded; swallow FCM failures silently.
  }
}
