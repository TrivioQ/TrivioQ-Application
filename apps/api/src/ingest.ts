/**
 * Ingestion entry-point.
 *
 * Run with:
 *   yarn ingest
 *   # or
 *   npx ts-node -r dotenv/config src/ingest.ts
 *
 * Environment variables:
 *   INGESTION_AI_PROVIDER  — "google" | "nvidia"  (default: "google")
 *   INGESTION_DIR          — path relative to cwd  (default: "ingestion")
 */
import 'dotenv/config';
import { runIngestion } from './ai-question-ingestion/runner';

runIngestion().catch((err) => {
  console.error('[Ingest] Fatal error:', err);
  process.exit(1);
});
