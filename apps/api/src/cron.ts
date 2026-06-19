import cron from 'node-cron';
process.env.TZ = 'UTC';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';
import { distributeBonuses, getWeekStart, getMonthStart } from './utils/scoring';
import { initDropPlanner } from './services/drop-planner-service';
import { initNotificationCrons } from './crons/notification-crons';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const triviaDropsQueue = new Queue('trivia-drops', { connection });

// ── Trivia drop scheduler — runs every 15 mins ────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  console.log('Running cron job to find eligible users for trivia drops...');
  try {
    const now = new Date();

    // Find users eligible for a trivia drop
    // For this example, assuming activeWindowStart and activeWindowEnd encompass 'now'
    const eligibleUsers = await prisma.user.findMany({
      where: {
        activeWindowStart: { lte: now },
        activeWindowEnd: { gte: now },
      },
    });

    console.log(`Found ${eligibleUsers.length} eligible users.`);

    for (const user of eligibleUsers) {
      await triviaDropsQueue.add('drop-question', {
        userId: user.id,
        timestamp: now.getTime(),
      });
      console.log(`Added job to trivia-drops queue for user ${user.id}`);
    }
  } catch (error) {
    console.error('Error running trivia drop cron job:', error);
  }
});

// ── Weekly bonus — every Monday at 00:05 ─────────────────────────────────────
// Distributes bonus points to the top 10 users of the PREVIOUS week.
cron.schedule('5 0 * * 1', async () => {
  console.log('[bonus-cron] Distributing weekly bonuses...');
  try {
    // Previous week's Monday (7 days ago)
    const prevWeekStart = getWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    await distributeBonuses('WEEKLY', prevWeekStart);
  } catch (error) {
    console.error('[bonus-cron] Error distributing weekly bonuses:', error);
  }
});

// ── Monthly bonus — 1st of every month at 00:10 ──────────────────────────────
// Distributes bonus points to the top 10 users of the PREVIOUS month.
cron.schedule('10 0 1 * *', async () => {
  console.log('[bonus-cron] Distributing monthly bonuses...');
  try {
    // Previous month's start: go back one month from the 1st of this month
    const now = new Date();
    const prevMonthStart = getMonthStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
    await distributeBonuses('MONTHLY', prevMonthStart);
  } catch (error) {
    console.error('[bonus-cron] Error distributing monthly bonuses:', error);
  }
});

// ── Daily drop planner — pre-schedules all user drops for the day ─────────────
initDropPlanner();

// ── Notification cron jobs ─────────────────────────────────────────────────────
initNotificationCrons();

console.log('node-cron job scheduler initialized.');
