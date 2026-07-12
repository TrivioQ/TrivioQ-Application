import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from the monorepo root .env
// __dirname at runtime = apps/api/dist/config/ → 4 levels up = repo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Define the schema for environment variables
const envSchema = z.object({
  PORT: z.string().default('3013'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

// Parse and validate process.env
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
