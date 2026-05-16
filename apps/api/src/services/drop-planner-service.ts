import cron from 'node-cron';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';
import { getSettingNumber } from '../utils/settings';

interface DropsQueuePayload {
  userId: string;
  isMasteryDay: boolean;
  dailyLimit: number;
}

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const dropsQueue = new Queue<DropsQueuePayload>('drops-queue', { connection });

/**
 * Calculates how many milliseconds until a given UTC wall-clock time (DateTime)
 * fires today, starting from `from`. Returns a non-negative delay in ms.
 */
function msUntilWindowStart(windowStart: Date, from: Date): number {
  // activeWindowStart is stored as a full DateTime; extract only the time-of-day
  // portion and apply it to today's UTC date so the delay is always relative to now.
  const todayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), windowStart.getUTCHours(), windowStart.getUTCMinutes(), windowStart.getUTCSeconds());
  const diff = todayStart - from.getTime();
  return Math.max(0, diff);
}

export async function scheduleDailyDrops(): Promise<void> {
  const now = new Date();
  console.log('[DropPlanner] scheduleDailyDrops running at', now.toISOString());

  const [freeLimit, premiumLimit] = await Promise.all([getSettingNumber('max_drops_free', 7), getSettingNumber('max_drops_premium', 100)]);

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: {
      id: true,
      subscriptionTier: true,
      currentStreak: true,
      activeWindowStart: true,
      activeWindowEnd: true,
    },
  });

  console.log(`[DropPlanner] Planning drops for ${users.length} users`);

  const results = await Promise.allSettled(
    users.map(async (user) => {
      const isMasteryDay = user.currentStreak > 0 && user.currentStreak % 7 === 0;

      const dailyLimit = user.subscriptionTier === 'PREMIUM' ? premiumLimit : freeLimit;

      // Active window duration in minutes
      const windowMs = user.activeWindowEnd.getTime() - user.activeWindowStart.getTime();
      const windowMinutes = Math.max(1, Math.floor(windowMs / 60_000));

      // Base interval between drops, in ms
      const baseIntervalMs = (windowMinutes / dailyLimit) * 60_000;

      // Offset from now until the window opens today (may be 0 if already open)
      const windowOffsetMs = msUntilWindowStart(user.activeWindowStart, now);

      const jobs: Promise<unknown>[] = [];

      for (let i = 0; i < dailyLimit; i++) {
        // Jitter: uniform random between -5 and +5 minutes
        const jitterMs = (Math.random() * 10 - 5) * 60_000;
        const delayMs = Math.max(0, windowOffsetMs + i * baseIntervalMs + jitterMs);

        const scheduledFor = new Date(now.getTime() + delayMs);

        jobs.push(dropsQueue.add('schedule-drop', { userId: user.id, isMasteryDay, dailyLimit }, { delay: delayMs, jobId: `drop-${user.id}-${scheduledFor.getTime()}` }));
      }

      await Promise.all(jobs);
      console.log(`[DropPlanner] Queued ${dailyLimit} drops for user ${user.id} (mastery=${isMasteryDay})`);
    }),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[DropPlanner] ${failed.length} user(s) failed to schedule:`, failed);
  }
}

// ── Daily drop planner — runs every day at 00:00 UTC ─────────────────────────
export function initDropPlanner(): void {
  cron.schedule('0 0 * * *', async () => {
    try {
      await scheduleDailyDrops();
    } catch (error) {
      console.error('[DropPlanner] Fatal error in scheduleDailyDrops:', error);
    }
  });

  console.log('[DropPlanner] initialized — will run daily at 00:00 UTC');
}
