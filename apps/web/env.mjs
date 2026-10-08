import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_URL: z.string().url(),
    // Firebase credentials — server-only. Never sent to the browser.
    FIREBASE_API_KEY: z.string().min(1),
    FIREBASE_PROJECT_ID: z.string().min(1),
    // Google OAuth 2.0 — server-only.
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    // Public base URL used to build the OAuth redirect URI.
    APP_URL: z.string().url(),
  },
  client: {
    // No secrets exposed to the browser.
    // Store listings for the landing page download buttons (hidden when unset).
    NEXT_PUBLIC_APP_STORE_URL: z.string().url().optional(),
    NEXT_PUBLIC_PLAY_STORE_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_APP_STORE_URL: process.env.NEXT_PUBLIC_APP_STORE_URL,
    NEXT_PUBLIC_PLAY_STORE_URL: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
