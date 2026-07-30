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
import { CronManager } from './lib/cron-manager';
import { registerAllCrons } from './crons/registry';

// ── Register all cron jobs ───────────────────────────────────────────────────
registerAllCrons();

// Start the manager
CronManager.initialize()
  .then(() => {
    console.log('CronManager initialized.');
  })
  .catch(console.error);
