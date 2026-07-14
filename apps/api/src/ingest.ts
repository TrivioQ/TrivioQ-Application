/**
 * Ingestion entry-point.
 *
 * Run with:
 *   pnpm ingest
 *   # or
 *   npx ts-node -r dotenv/config src/ingest.ts
 *
 * Environment variables:
 *   INGESTION_AI_PROVIDER  — "google" | "nvidia"  (default: "google")
 *   INGESTION_DIR          — path relative to cwd  (default: "ingestion")
 */
import dotenv from 'dotenv';
import path from 'path';
// Load from the monorepo root .env
// ts-node: __dirname = apps/api/src/ → 3 levels up = repo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { runIngestion } from './ai-question-ingestion/runner';

const reuploadOnly = process.argv.includes('--reupload');

runIngestion({ reuploadOnly }).catch((err) => {
  console.error('[Ingest] Fatal error:', err);
  process.exit(1);
});
