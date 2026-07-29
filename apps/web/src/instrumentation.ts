import * as Sentry from '@sentry/nextjs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      sendDefaultPii: false,
      integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      sendDefaultPii: false,
      integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
    });
  }
}
