import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    FIREBASE_API_KEY: z.string().min(1),
    API_URL: z.string().url(),
  },
  client: {
    // No secrets exposed to the browser.
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    API_URL: process.env.API_URL,
  },
  emptyStringAsUndefined: true,
});
