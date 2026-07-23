import cron from 'node-cron';
process.env.TZ = 'UTC';
import { distributeBonuses, getWeekStart, getMonthStart } from './utils/scoring';
import { initDropPlanner } from './services/drop-planner-service';
import { initNotificationCrons } from './crons/notification-crons';
import { initQuestionValidationCron } from './crons/question-validation-cron';

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

// ── AI question validation — runs daily at 10:00 AM UTC ────────────────────────
initQuestionValidationCron();

console.log('node-cron job scheduler initialized.');
