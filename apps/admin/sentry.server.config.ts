import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],
});
