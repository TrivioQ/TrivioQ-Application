import pino from 'pino';
const isDev = process.env.NODE_ENV !== 'production';

const pinoLogger = pino({
  redact: ['email', 'firebaseUid', 'password'],
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
    },
  }),
});

export async function logBusinessAction(source: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
  pinoLogger.info({ source, action, ...metadata });
}

export { pinoLogger };
