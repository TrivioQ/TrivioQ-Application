import fs from 'fs';
import path from 'path';
import { IngestionOrchestrator } from './orchestrator';
import { pdfToImage } from './utils/pdf-to-image';
import type { AIProviderName } from './providers';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Schema for `manifest.json` placed inside each book sub-folder.
 *
 * Example file:
 * ```json
 * {
 *   "bookId":             "world-history-vol1",
 *   "topic":              "World History",
 *   "categorySlugs":      ["history", "geography"],
 *   "specialInstruction": "Focus only on chapters 3–6. Ignore appendices.",
 *   "pages":              { "from": 5, "to": 40 }
 * }
 * ```
 */
export interface ManifestJson {
  /** Unique identifier for this book (used as state-file prefix). */
  bookId: string;
  /** Process type to use for this book (e.g. 'question-extraction'). Defaults to 'question-extraction'. */
  processType?: string;
  /** Human-readable topic passed to the database row. */
  topic?: string;
  /**
   * One or more category slugs that must already exist in the Category table.
   * A PendingQuestion row is created for each slug.
   */
  categorySlugs?: string[];
  /**
   * Optional free-text instruction injected into the extraction prompt only
   * (e.g. "Extract only chapters 3–6. Strip exam year markers.").
   */
  extractionSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the enhancement prompt only
   * (e.g. "This book contains Indian competitive exam questions.").
   */
  enhancementSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the classification prompt only
   * (e.g. "Some pages have inline answers. Do not classify as QUESTIONS_WITH_KEYS.").
   */
  classificationSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the summarization prompt only.
   */
  summarizationSpecialInstruction?: string;

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
    generation?: AIProviderName;
    summarization?: AIProviderName;
  };

  /**
   * Optional page range to limit which pages of the PDF are converted to
   * images and sent for AI processing.
   *
   * When omitted, all pages are converted (default behaviour).
   *
   * Example:
   * ```json
   * "pages": { "from": 5, "to": 40 }
   * ```
   */
  pages?: {
    /**
     * 1-based first page to extract (inclusive).
     * Defaults to 1 when only `to` is provided.
     */
    from?: number;
    /**
     * 1-based last page to extract (inclusive).
     * Defaults to the last page of the PDF when only `from` is provided.
     */
    to?: number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MANIFEST_FILE = 'manifest.json';
const DATA_DIR_NAME = 'data';

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Scans the `ingestion/` directory (resolved relative to the API process cwd)
 * for book sub-folders.
 *
 * For each sub-folder that contains **both** an `manifest.json` and a
 * `.pdf` file the runner will:
 *
 * 1. Parse `manifest.json` to obtain topic, categorySlugs, and an optional
 *    specialInstruction.
 * 2. Create a `data/` folder inside that sub-folder (if absent).
 * 3. Convert the PDF to images stored in `data/` (optionally limited to the
 *    page range specified by `pages.from` / `pages.to`).
 * 4. Run `IngestionOrchestrator` with those images — sequentially, one book at
 *    a time.
 *
 * The AI provider is read from the `INGESTION_AI_PROVIDER` env var (defaults to
 * `'google'`).  The `INGESTION_DIR` env var can override the base directory
 * (default: `ingestion`).
 */
export async function runIngestion(options?: { reuploadOnly?: boolean }): Promise<void> {
  const ingestionRoot = path.resolve(process.cwd(), process.env.INGESTION_DIR ?? 'ingestion');

  if (!fs.existsSync(ingestionRoot)) {
    console.warn(`[Runner] Ingestion directory not found: ${ingestionRoot}`);
    console.warn('[Runner] Create it and add sub-folders with manifest.json + a PDF.');
    return;
  }

  const aiProvider = (process.env.INGESTION_AI_PROVIDER as AIProviderName | undefined) ?? 'google';
  console.log(`[Runner] Scanning: ${ingestionRoot}`);
  console.log(`[Runner] AI provider: ${aiProvider}`);

  const entries = fs.readdirSync(ingestionRoot, { withFileTypes: true });
  const bookDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('__'));

  if (bookDirs.length === 0) {
    console.log('[Runner] No sub-folders found — nothing to process.');
    return;
  }

  let processed = 0;
  let skipped = 0;

  for (const dir of bookDirs) {
    const bookDir = path.join(ingestionRoot, dir.name);
    console.log(`\n[Runner] ── Checking: ${dir.name}`);

    // ── Validate manifest.json ────────────────────────────────────────────
    const manifestPath = path.join(bookDir, MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[Runner] Skipping — no ${MANIFEST_FILE} found`);
      skipped++;
      continue;
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ManifestJson;
    } catch (err) {
      console.error(`[Runner] Skipping — failed to parse ${MANIFEST_FILE}:`, err);
      skipped++;
      continue;
    }

    if (!manifest.bookId) {
      console.error(`[Runner] Skipping — ${MANIFEST_FILE} is missing required field (bookId)`);
      skipped++;
      continue;
    }

    if (manifest.categorySlugs !== undefined && (!Array.isArray(manifest.categorySlugs) || manifest.categorySlugs.length === 0)) {
      console.error(`[Runner] Skipping — ${MANIFEST_FILE} field "categorySlugs" must be a non-empty array of strings if provided`);
      skipped++;
      continue;
    }

    // ── Validate pages range (if provided) ───────────────────────────────────
    if (manifest.pages !== undefined) {
      const { from, to } = manifest.pages;
      const fromValid = from === undefined || (Number.isInteger(from) && from >= 1);
      const toValid = to === undefined || (Number.isInteger(to) && to >= 1);

      if (!fromValid || !toValid) {
        console.error(`[Runner] Skipping — ${MANIFEST_FILE} field "pages.from" and "pages.to" must be positive integers when provided`);
        skipped++;
        continue;
      }

      if (from !== undefined && to !== undefined && from > to) {
        console.error(`[Runner] Skipping — ${MANIFEST_FILE} field "pages.from" (${from}) must be less than or equal to "pages.to" (${to})`);
        skipped++;
        continue;
      }
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

    const pagesDir = path.join(dataDir, 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
      console.log(`[Runner] Created pages directory: ${pagesDir}`);
    }

    // ── Convert PDF → images ──────────────────────────────────────────────────
    let imagePaths: string[] = [];
    if (!options?.reuploadOnly) {
      console.log(`[Runner] Converting PDF: ${pdfFiles[0]}`);

      // Log the effective page range
      if (manifest.pages?.from !== undefined || manifest.pages?.to !== undefined) {
        const fromLabel = manifest.pages.from ?? 1;
        const toLabel = manifest.pages.to !== undefined ? String(manifest.pages.to) : 'last';
        console.log(`[Runner] Page range: ${fromLabel} → ${toLabel}`);
      } else {
        console.log('[Runner] Page range: all pages');
      }

      try {
        imagePaths = await pdfToImage(pdfPath, pagesDir, {
          fromPage: manifest.pages?.from,
          toPage: manifest.pages?.to,
        });
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
    } else {
      console.log(`[Runner] Reupload mode: skipping PDF conversion for ${pdfFiles[0]}`);
    }

    console.log(`[Runner] bookId: ${manifest.bookId}`);
    if (manifest.topic) {
      console.log(`[Runner] topic: ${manifest.topic}`);
    } else {
      console.log('[Runner] topic: to be auto-detected');
    }
    if (manifest.categorySlugs) {
      console.log(`[Runner] categorySlugs: ${manifest.categorySlugs.join(', ')}`);
    } else {
      console.log('[Runner] categorySlugs: to be selected from all DB categories');
    }

    // ── Run orchestrator (sequential — awaited fully before next book) ─────────
    try {
      const orchestrator = new IngestionOrchestrator(manifest.bookId, imagePaths, {
        outputDir: dataDir,
        processType: manifest.processType ?? 'question-extraction',
        topic: manifest.topic ?? '',
        categorySlugs: manifest.categorySlugs ?? [],
        aiProvider,
        providers: manifest.providers,
        extractionSpecialInstruction: manifest.extractionSpecialInstruction,
        enhancementSpecialInstruction: manifest.enhancementSpecialInstruction,
        classificationSpecialInstruction: manifest.classificationSpecialInstruction,
        summarizationSpecialInstruction: manifest.summarizationSpecialInstruction,
      });

      await orchestrator.run(options);
      processed++;
      console.log(`[Runner] ✓ Completed: ${dir.name}`);
    } catch (err) {
      console.error(`[Runner] ✗ Orchestrator failed for ${dir.name}:`, err);
      skipped++;
    }
  }

  console.log(`\n[Runner] Done — processed: ${processed}, skipped/failed: ${skipped}`);
}
