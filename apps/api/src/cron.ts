import * as Sentry from '@sentry/node';

// ── GlitchTip / Sentry error reporting ───────────────────────────────────────
// Must be initialized before any other imports so the SDK can instrument them.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
  // Scrub PII from all outgoing events
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

process.env.TZ = 'UTC';
import { distributeBonuses, getWeekStart, getMonthStart } from './utils/scoring';
import { initDropPlanner } from './services/drop-planner-service';
import { initNotificationCrons } from './crons/notification-crons';
import { initQuestionValidationCron } from './crons/question-validation-cron';
import { CronManager } from './lib/cron-manager';

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
// (Assuming initDropPlanner registers its own cron jobs)
initDropPlanner();

// ── Notification cron jobs ─────────────────────────────────────────────────────
initNotificationCrons();

// ── AI question validation — runs daily at 10:00 AM UTC ────────────────────────
initQuestionValidationCron();

// Start the manager
CronManager.initialize()
  .then(() => {
    console.log('CronManager initialized.');
  })
  .catch(console.error);
