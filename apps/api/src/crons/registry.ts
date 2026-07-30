import { CronManager } from '../lib/cron-manager';
import { distributeBonuses, getWeekStart, getMonthStart } from '../utils/scoring';
import { initDropPlanner } from '../services/drop-planner-service';
import { initNotificationCrons } from './notification-crons';
import { initQuestionValidationCron } from './question-validation-cron';

export function registerAllCrons() {
  // ── Weekly bonus — every Monday at 00:05 ─────────────────────────────────────
  // Distributes bonus points to the top 10 users of the PREVIOUS week.
  CronManager.register('Weekly Bonuses', '5 0 * * 1', async (signal) => {
    console.log('[bonus-cron] Distributing weekly bonuses...');
    const prevWeekStart = getWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    await distributeBonuses('WEEKLY', prevWeekStart, signal);
  });

  // ── Monthly bonus — 1st of every month at 00:10 ──────────────────────────────
  // Distributes bonus points to the top 10 users of the PREVIOUS month.
  CronManager.register('Monthly Bonuses', '10 0 1 * *', async (signal) => {
    console.log('[bonus-cron] Distributing monthly bonuses...');
    const now = new Date();
    const prevMonthStart = getMonthStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
    await distributeBonuses('MONTHLY', prevMonthStart, signal);
  });

  // ── Daily drop planner — pre-schedules all user drops for the day ─────────────
  initDropPlanner();

  // ── Notification cron jobs ─────────────────────────────────────────────────────
  initNotificationCrons();

  // ── AI question validation — runs daily at 10:00 AM UTC ────────────────────────
  initQuestionValidationCron();
}
