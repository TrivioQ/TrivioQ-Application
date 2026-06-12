import * as Sentry from '@sentry/node';
import { pinoLogger } from './logger';

const sentryEnabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_SENTRY === '1';

export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (sentryEnabled) {
    Sentry.captureException(error, { extra: context });
  } else {
    pinoLogger.error({ err: error, ...context });
  }
}
