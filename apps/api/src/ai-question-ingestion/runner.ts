import fs from 'fs';
import path from 'path';
import { IngestionOrchestrator } from './orchestrator';
import { pdfToImage } from './utils/pdfToImage';
import type { AIProviderName } from './providers';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Schema for `instructions.json` placed inside each book sub-folder.
 *
 * Example file:
 * ```json
 * {
 *   "bookId":             "world-history-vol1",
 *   "topic":              "World History",
 *   "categorySlugs":      ["history", "geography"],
 *   "specialInstruction": "Focus only on chapters 3–6. Ignore appendices."
 * }
 * ```
 */
export interface InstructionsJson {
  /** Unique identifier for this book (used as state-file prefix). */
  bookId: string;
  /** Human-readable topic passed to the database row. */
  topic?: string;
  /**
   * One or more category slugs that must already exist in the Category table.
   * A PendingQuestion row is created for each slug.
   */
  categorySlugs?: string[];
  /**
   * Optional free-text instruction injected into extraction and enhancement
   * prompts (e.g. "Focus only on chapters 3–6.").
   */
  specialInstruction?: string;
  /**
   * Per-phase AI provider overrides for this book.
   * Falls back to the INGESTION_*_PROVIDER env vars and finally to 'google'.
   *
   * Example:
   * ```json
   * "providers": {
   *   "scout":      "google",
   *   "extraction": "google",
   *   "enhancement": "nvidia"
   * }
   * ```
   */
  providers?: {
    scout?: AIProviderName;
    extraction?: AIProviderName;
    enhancement?: AIProviderName;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INSTRUCTIONS_FILE = 'instructions.json';
const DATA_DIR_NAME = 'data';

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Scans the `ingestion/` directory (resolved relative to the API process cwd)
 * for book sub-folders.
 *
 * For each sub-folder that contains **both** an `instructions.json` and a
 * `.pdf` file the runner will:
 *
 * 1. Parse `instructions.json` to obtain topic, categorySlugs, and an optional
 *    specialInstruction.
 * 2. Create a `data/` folder inside that sub-folder (if absent).
 * 3. Convert the PDF to images stored in `data/`.
 * 4. Run `IngestionOrchestrator` with those images — sequentially, one book at
 *    a time.
 *
 * The AI provider is read from the `INGESTION_AI_PROVIDER` env var (defaults to
 * `'google'`).  The `INGESTION_DIR` env var can override the base directory
 * (default: `ingestion`).
 */
export async function runIngestion(): Promise<void> {
  const ingestionRoot = path.resolve(process.cwd(), process.env.INGESTION_DIR ?? 'ingestion');

  if (!fs.existsSync(ingestionRoot)) {
    console.warn(`[Runner] Ingestion directory not found: ${ingestionRoot}`);
    console.warn('[Runner] Create it and add sub-folders with instructions.json + a PDF.');
    return;
  }

  const aiProvider = (process.env.INGESTION_AI_PROVIDER as AIProviderName | undefined) ?? 'google';
  console.log(`[Runner] Scanning: ${ingestionRoot}`);
  console.log(`[Runner] AI provider: ${aiProvider}`);

  const entries = fs.readdirSync(ingestionRoot, { withFileTypes: true });
  const bookDirs = entries.filter((e) => e.isDirectory());

  if (bookDirs.length === 0) {
    console.log('[Runner] No sub-folders found — nothing to process.');
    return;
  }

  let processed = 0;
  let skipped = 0;

  for (const dir of bookDirs) {
    const bookDir = path.join(ingestionRoot, dir.name);
    console.log(`\n[Runner] ── Checking: ${dir.name}`);

    // ── Validate instructions.json ────────────────────────────────────────────
    const instructionsPath = path.join(bookDir, INSTRUCTIONS_FILE);
    if (!fs.existsSync(instructionsPath)) {
      console.warn(`[Runner] Skipping — no ${INSTRUCTIONS_FILE} found`);
      skipped++;
      continue;
    }

    let instructions: InstructionsJson;
    try {
      instructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8')) as InstructionsJson;
    } catch (err) {
      console.error(`[Runner] Skipping — failed to parse ${INSTRUCTIONS_FILE}:`, err);
      skipped++;
      continue;
    }

    if (!instructions.bookId) {
      console.error(`[Runner] Skipping — ${INSTRUCTIONS_FILE} is missing required field (bookId)`);
      skipped++;
      continue;
    }

    if (instructions.categorySlugs !== undefined && (!Array.isArray(instructions.categorySlugs) || instructions.categorySlugs.length === 0)) {
      console.error(`[Runner] Skipping — ${INSTRUCTIONS_FILE} field "categorySlugs" must be a non-empty array of strings if provided`);
      skipped++;
      continue;
    }

    // ── Locate PDF ────────────────────────────────────────────────────────────
    const allFiles = fs.readdirSync(bookDir);
    const pdfFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.warn('[Runner] Skipping — no .pdf file found');
      skipped++;
      continue;
    }

    if (pdfFiles.length > 1) {
      console.warn(`[Runner] Multiple PDFs found — using the first one: ${pdfFiles[0]}`);
    }

    const pdfPath = path.join(bookDir, pdfFiles[0]);

    // ── Prepare data directory ────────────────────────────────────────────────
    const dataDir = path.join(bookDir, DATA_DIR_NAME);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[Runner] Created data directory: ${dataDir}`);
    }

    // ── Convert PDF → images ──────────────────────────────────────────────────
    console.log(`[Runner] Converting PDF: ${pdfFiles[0]}`);
    let imagePaths: string[];
    try {
      imagePaths = await pdfToImage(pdfPath, dataDir);
    } catch (err) {
      console.error('[Runner] Failed to convert PDF — skipping book:', err);
      skipped++;
      continue;
    }

    if (imagePaths.length === 0) {
      console.warn('[Runner] PDF produced no images — skipping');
      skipped++;
      continue;
    }

    console.log(`[Runner] ${imagePaths.length} images produced → starting orchestrator`);
    console.log(`[Runner] bookId: ${instructions.bookId}`);
    if (instructions.topic) {
      console.log(`[Runner] topic: ${instructions.topic}`);
    } else {
      console.log('[Runner] topic: to be auto-detected');
    }
    if (instructions.categorySlugs) {
      console.log(`[Runner] categorySlugs: ${instructions.categorySlugs.join(', ')}`);
    } else {
      console.log('[Runner] categorySlugs: to be selected from all DB categories');
    }

    // ── Run orchestrator (sequential — awaited fully before next book) ─────────
    try {
      const orchestrator = new IngestionOrchestrator(instructions.bookId, imagePaths, {
        outputDir: dataDir,
        topic: instructions.topic ?? '',
        categorySlugs: instructions.categorySlugs ?? [],
        aiProvider,
        providers: instructions.providers,
        extractionSpecialInstruction: instructions.specialInstruction,
        enhancementSpecialInstruction: instructions.specialInstruction,
      });

      await orchestrator.run();
      processed++;
      console.log(`[Runner] ✓ Completed: ${dir.name}`);
    } catch (err) {
      console.error(`[Runner] ✗ Orchestrator failed for ${dir.name}:`, err);
      skipped++;
    }
  }

  console.log(`\n[Runner] Done — processed: ${processed}, skipped/failed: ${skipped}`);
}
