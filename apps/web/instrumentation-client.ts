import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
