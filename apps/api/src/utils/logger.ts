import pino from 'pino';
import { prisma } from '@trivioq/database';
import type { Prisma } from '@trivioq/database';

const isDev = process.env.NODE_ENV !== 'production';

const pinoLogger = pino({
  redact: ['email', 'firebaseUid', 'password'],
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
    },
  }),
});

export async function logBusinessAction(
  source: string,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  pinoLogger.info({ source, action, ...metadata });

  try {
    await prisma.systemLog.create({
      data: {
        level: 'INFO',
        source,
        action,
        ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  } catch {
    // Database logging failure must not crash the main thread
  }
}

export { pinoLogger };
