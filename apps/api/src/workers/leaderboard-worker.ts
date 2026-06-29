import cron from 'node-cron';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';
import { getWeekStart } from '../utils/scoring';

const QUEUE_NAME = 'weekly-leaderboard';
const FALLBACK_REWARDS = [1000, 800, 600, 400, 200, 100, 100, 100, 50, 50];

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const leaderboardQueue = new Queue(QUEUE_NAME, { connection: connection as any });

// ── Core logic ────────────────────────────────────────────────────────────────

export async function processWeeklyLeaderboard(): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);

  console.log('[LeaderboardWorker] processWeeklyLeaderboard starting at', now.toISOString());

  // 1. Resolve active BonusPlan for this week (if any)
  const activePlan = await prisma.bonusPlan.findFirst({
    where: {
      periodType: 'WEEK',
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  const rewards: number[] = activePlan ? activePlan.payoutValues : FALLBACK_REWARDS;
  const rewardType: 'POINTS' | 'PREMIUM_DAYS' = activePlan ? (activePlan.rewardType as 'POINTS' | 'PREMIUM_DAYS') : 'POINTS';

  console.log(`[LeaderboardWorker] Reward type: ${rewardType}, slots: ${rewards.length},`, activePlan ? `plan: ${activePlan.id}` : 'fallback');

  // 2. Fetch exactly as many top users as we have reward slots
  const topScores = await prisma.userScore.findMany({
    where: { periodType: 'WEEKLY', periodStart: weekStart },
    orderBy: { totalScore: 'desc' },
    take: rewards.length,
    select: { userId: true, totalScore: true },
  });

  // 3. Build one update promise per winner
  const rewardUpdates = topScores.map((row, index) => {
    const amount = rewards[index] ?? 0;

    if (rewardType === 'PREMIUM_DAYS') {
      return prisma.user.update({
        where: { id: row.userId },
        data: { onDemandTokens: { increment: amount } },
      });
    }

    // POINTS
    return prisma.user.update({
      where: { id: row.userId },
      data: { points: { increment: amount } },
    });
  });

  // 4. Reset all weekly UserScore rows for the completed week
  const weeklyReset = prisma.userScore.updateMany({
    where: { periodType: 'WEEKLY', periodStart: weekStart },
    data: { baseScore: 0, bonusScore: 0, totalScore: 0 },
  });

  // 5. Execute rewards + reset atomically
  await prisma.$transaction([...rewardUpdates, weeklyReset]);

  console.log(`[LeaderboardWorker] Rewarded ${topScores.length} user(s) and reset weekly scores.`);
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

const leaderboardWorker = new Worker(
  QUEUE_NAME,
  async () => {
    await processWeeklyLeaderboard();
  },
  { connection: connection as any, concurrency: 1 },
);

leaderboardWorker.on('completed', (job) => {
  console.log(`[LeaderboardWorker] Job ${job.id} completed`);
});

leaderboardWorker.on('failed', (job, err) => {
  console.error(`[LeaderboardWorker] Job ${job?.id} failed:`, err);
});

// ── Cron trigger — 23:59 UTC every Sunday ─────────────────────────────────────

export function initLeaderboardWorker(): void {
  cron.schedule('59 23 * * 0', async () => {
    try {
      await leaderboardQueue.add('process-weekly-leaderboard', {});
      console.log('[LeaderboardWorker] Queued weekly leaderboard job');
    } catch (error) {
      console.error('[LeaderboardWorker] Failed to queue weekly leaderboard job:', error);
    }
  });

  console.log('[LeaderboardWorker] Initialized — will run at 23:59 UTC every Sunday');
}
