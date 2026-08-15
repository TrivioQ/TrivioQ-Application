/**
 * Ingestion Worker — Fire-and-Forget HTTP Server
 *
 * This module runs as a standalone Express HTTP server (port 3014) inside the
 * `trivioq-worker-ingestion` container.  It replaces the BullMQ-based approach
 * which was unreliable for long-running (hours-to-days) AI ingestion jobs due to
 * Redis lock TTL expiry (stalled jobs).
 *
 * Architecture:
 *  - POST /internal/run    → starts a job in the background (fire-and-forget)
 *  - POST /internal/cancel → aborts a running job
 *  - GET  /health          → liveness probe
 *
 * Resilience:
 *  - state.json (Docker volume) is the primary checkpoint; never lost on restart.
 *  - DB is updated via syncProgressToDB() which retries with backoff and NEVER throws.
 *  - If DB writes give up, the data is saved to _pending_db_sync.json on the volume.
 *  - A watchdog interval (60 s) flushes the pending sync file when DB recovers.
 *  - A heartbeat timer (30 s) per job writes lastHeartbeatAt to DB.
 *  - On startup, recoverOnStartup() flushes pending sync then re-triggers PROCESSING jobs.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load root .env when running locally (no-op in Docker where vars are already injected)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import express from 'express';
import { prisma, ProcessType, IngestionStatus } from '@trivioq/database';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { pdfToImage } from '../ai-question-ingestion/utils/pdf-to-image';
import { IngestionOrchestrator } from '../ai-question-ingestion/orchestrator';
import { IngestionState } from '../ai-question-ingestion/utils/state-manager';
import type { ManifestJson } from '../ai-question-ingestion/processes/process.interface';
import { WorkflowLogger } from '../utils/workflow-logger';

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.WORKER_INGESTION_PORT ?? '3014', 10);
const ingestionRoot = path.resolve(process.cwd(), process.env.INGESTION_DIR ?? 'ingestion');
const PENDING_SYNC_PATH = path.join(ingestionRoot, '_pending_db_sync.json');

// ── In-memory job registry ────────────────────────────────────────────────────

interface RunningJobContext {
  bookId: string;
  dataDir: string;
  abortController: AbortController;
  heartbeatTimer: ReturnType<typeof setInterval>;
  logger: WorkflowLogger;
}

const runningJobs = new Map<string, RunningJobContext>();

// ── Job Queue (Concurrency Control) ───────────────────────────────────────────

interface PendingJob {
  jobId: string;
  forcePhase?: string;
}

const jobQueue: PendingJob[] = [];
let currentLockHolder: string | null = null;

function processNextJob() {
  if (currentLockHolder !== null || jobQueue.length === 0) return;
  const nextJob = jobQueue.shift();
  if (!nextJob) return;

  currentLockHolder = nextJob.jobId;
  runJob(nextJob.jobId, nextJob.forcePhase)
    .catch((err) => {
      console.error(`[IngestionWorker] Unhandled error in runJob(${nextJob.jobId}):`, err);
    })
    .finally(() => {
      // If this job still holds the lock (e.g. it failed or never reached UPLOAD phase), release it.
      if (currentLockHolder === nextJob.jobId) {
        currentLockHolder = null;
        processNextJob();
      }
    });
}

// ── Pending sync store (persists final status to disk when DB is down) ────────

const pendingSyncStore = {
  set(jobId: string, data: Record<string, unknown>): void {
    try {
      const file = fs.existsSync(PENDING_SYNC_PATH) ? (JSON.parse(fs.readFileSync(PENDING_SYNC_PATH, 'utf-8')) as Record<string, unknown>) : {};
      file[jobId] = { data, savedAt: new Date().toISOString() };
      fs.writeFileSync(PENDING_SYNC_PATH, JSON.stringify(file, null, 2));
    } catch (e) {
      console.error('[PendingSync] Failed to write pending sync file:', e);
    }
  },

  delete(jobId: string): void {
    try {
      if (!fs.existsSync(PENDING_SYNC_PATH)) return;
      const file = JSON.parse(fs.readFileSync(PENDING_SYNC_PATH, 'utf-8')) as Record<string, { data: unknown }>;
      delete file[jobId];
      fs.writeFileSync(PENDING_SYNC_PATH, JSON.stringify(file, null, 2));
    } catch (e) {
      console.error('[PendingSync] Failed to delete entry from pending sync file:', e);
    }
  },

  getAll(): Record<string, { data: Record<string, unknown> }> {
    try {
      if (!fs.existsSync(PENDING_SYNC_PATH)) return {};
      return JSON.parse(fs.readFileSync(PENDING_SYNC_PATH, 'utf-8'));
    } catch {
      return {};
    }
  },
};

// ── DB sync helper (retries with backoff; NEVER throws) ───────────────────────

async function syncProgressToDB(jobId: string, data: Record<string, unknown>, retries = 3, requireProcessing = false): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (requireProcessing) {
        await prisma.ingestionJob.updateMany({
          where: { id: jobId, status: IngestionStatus.PROCESSING },
          data,
        });
      } else {
        await prisma.ingestionJob.update({ where: { id: jobId }, data });
      }
      pendingSyncStore.delete(jobId); // clear any previously saved pending entry
      return;
    } catch (e: any) {
      if (e.code === 'P2025') {
        console.warn(`[ProgressSync] Job ${jobId} not found in DB (likely deleted). Aborting sync.`);
        pendingSyncStore.delete(jobId);
        runningJobs.get(jobId)?.abortController.abort();
        return;
      }
      if (attempt === retries) {
        console.error(`[ProgressSync] Gave up after ${retries} attempts for job ${jobId}. Saving to pending sync.`);
        pendingSyncStore.set(jobId, data);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s, 3s…
    }
  }
}

// ── Phase progress weights ────────────────────────────────────────────────────

const PHASE_OFFSETS: Record<string, Record<string, number>> = {
  QUESTION_EXTRACTION: { SCOUT: 0, EXTRACTION: 20, ENHANCEMENT: 60, UPLOAD: 90 },
  // GENERATION covers both the summarization + generation step in one phase
  QUIZ_GENERATION: { GENERATION: 0, ENHANCEMENT: 60, UPLOAD: 90 },
};
const PHASE_WIDTHS: Record<string, Record<string, number>> = {
  QUESTION_EXTRACTION: { SCOUT: 20, EXTRACTION: 40, ENHANCEMENT: 30, UPLOAD: 10 },
  // GENERATION covers both the summarization + generation step in one phase
  QUIZ_GENERATION: { GENERATION: 60, ENHANCEMENT: 30, UPLOAD: 10 },
};

// ── Core job runner ───────────────────────────────────────────────────────────

async function runJob(jobId: string, forcePhase?: string): Promise<void> {
  const dbJob = await prisma.ingestionJob.findUnique({ where: { id: jobId } });

  if (!dbJob) {
    console.error(`[IngestionWorker] Job ${jobId} not found in database.`);
    return;
  }

  if (dbJob.status === IngestionStatus.PAUSED || dbJob.status === IngestionStatus.COMPLETED) {
    console.log(`[IngestionWorker] Job ${jobId} is ${dbJob.status}, skipping.`);
    return;
  }

  // Mark as PROCESSING immediately
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: IngestionStatus.PROCESSING, errorLogs: null, lastHeartbeatAt: new Date() },
  });

  const bookId = dbJob.id;
  const pdfPath = dbJob.storagePath;
  const dataDir = path.join(path.dirname(pdfPath), 'data');
  const pagesDir = path.join(dataDir, 'pages');
  const logger = new WorkflowLogger(path.join(dataDir, 'workflow.log'));
  logger.info('SYSTEM', `Job ${jobId} STARTED${forcePhase && forcePhase !== 'none' ? ` (forcePhase=${forcePhase})` : ''}`);

  // Setup abort controller for cancellation
  const abortController = new AbortController();
  const { signal } = abortController;

  // Start heartbeat timer (every 30 s)
  const heartbeatTimer = setInterval(async () => {
    if (signal.aborted) return;
    await syncProgressToDB(jobId, { lastHeartbeatAt: new Date() }, 2, true);
  }, 30_000);

  runningJobs.set(jobId, { bookId, dataDir, abortController, heartbeatTimer, logger });

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Reset state if forcePhase is provided
    if (forcePhase && forcePhase !== 'none') {
      const state = new IngestionState(bookId, dataDir);
      state.resetToPhase(forcePhase as 'SCOUT' | 'EXTRACTION' | 'ENHANCEMENT' | 'UPLOAD');
      logger.truncate();
      logger.info('SYSTEM', `Reset state to phase ${forcePhase}`);
    }

    const manifestData = ((dbJob.manifestData as unknown as ManifestJson) || {}) as Partial<ManifestJson>;
    const { pages } = manifestData;

    // ── Pre-flight: validate stage configs BEFORE reading/converting the PDF ──
    // This gives a fast, clear error rather than wasting minutes on PDF work.
    const pTypeStr = dbJob.processType === ProcessType.QUIZ_GENERATION ? 'quiz-generation' : 'question-extraction';
    const processKey = dbJob.processType === ProcessType.QUIZ_GENERATION ? 'QUIZ_GENERATION' : 'QUESTION_EXTRACTION';

    const stageConfigRows = await prisma.ingestionStageConfig.findMany({
      where: { isActive: true },
    });
    const stages = new Map(stageConfigRows.map((s) => [s.stage, s]));

    const stageOf = (name: 'scout' | 'extraction' | 'enhancement' | 'summarization' | 'generation') => {
      const row = stages.get(name);
      if (!row) {
        throw new Error(`[ingestion-worker] IngestionStageConfig for "${name}" is missing or inactive. Configure it in the admin portal.`);
      }
      if (!row.modelId) {
        throw new Error(`[ingestion-worker] IngestionStageConfig "${name}" has no modelId assigned.`);
      }
      return row;
    };

    // Eagerly validate all required stages for this process type.
    // QUESTION_EXTRACTION needs scout + extraction + enhancement.
    // QUIZ_GENERATION needs summarization + generation + enhancement.
    if (dbJob.processType === ProcessType.QUIZ_GENERATION) {
      stageOf('summarization');
      stageOf('generation');
      stageOf('enhancement');
    } else {
      stageOf('scout');
      stageOf('extraction');
      stageOf('enhancement');
    }
    logger.info('SYSTEM', 'Pre-flight stage config check passed');

    // ── Determine total pages & image conversion ──────────────────────────────
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pdfPageCount = pdfDoc.getPageCount();
    const start = pages?.from ?? 1;
    const end = pages?.to ?? pdfPageCount;
    const expectedPages = end - start + 1;
    const totalPages = expectedPages;
    logger.info('PDF', `Loaded ${pdfPageCount} pages, processing range ${start}-${end}`);

    // Persist total pages for UI display
    await syncProgressToDB(jobId, { totalPages }, 3);

    let imagePaths: string[] = [];

    if (fs.existsSync(pagesDir)) {
      fs.rmSync(pagesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(pagesDir, { recursive: true });

    logger.info('PDF', `Converting PDF to images for job ${jobId}...`);
    imagePaths = await pdfToImage(pdfPath, pagesDir, { fromPage: pages?.from, toPage: pages?.to });
    logger.info('PDF', `Conversion done — ${imagePaths.length} images`);

    if (imagePaths.length === 0) {
      throw new Error('PDF produced no images.');
    }

    // ── Build orchestrator ────────────────────────────────────────────────────
    const orchestrator = new IngestionOrchestrator(bookId, imagePaths, {
      outputDir: dataDir,
      processType: manifestData.processType ?? pTypeStr,
      topic: manifestData.topic ?? '',
      categorySlugs: manifestData.categorySlugs ?? [],
      stageModelIds: {
        scout: stageOf('scout').modelId ?? undefined,
        extraction: stageOf('extraction').modelId ?? undefined,
        enhancement: stageOf('enhancement').modelId ?? undefined,
        summarization: stageOf('summarization').modelId ?? undefined,
        generation: stageOf('generation').modelId ?? undefined,
      },
      modelOverrides: manifestData.modelOverrides,
      callDelays: {
        scout: stageOf('scout').callDelaySec,
        extraction: stageOf('extraction').callDelaySec,
        enhancement: stageOf('enhancement').callDelaySec,
        summarization: stageOf('summarization').callDelaySec,
        generation: stageOf('generation').callDelaySec,
      },
      temperatures: {
        scout: stageOf('scout').temperature,
        extraction: stageOf('extraction').temperature,
        enhancement: stageOf('enhancement').temperature,
        summarization: stageOf('summarization').temperature,
        generation: stageOf('generation').temperature,
      },
      extractionBatchSize: stageOf('extraction').batchSize ?? undefined,
      enhancementConcurrency: stageOf('enhancement').concurrency ?? undefined,
      extractionSpecialInstruction: manifestData.extractionSpecialInstruction,
      enhancementSpecialInstruction: manifestData.enhancementSpecialInstruction,
      classificationSpecialInstruction: manifestData.classificationSpecialInstruction,
      summarizationSpecialInstruction: manifestData.summarizationSpecialInstruction,
      logger,
    });

    logger.info('SYSTEM', `Orchestrator built: ${pTypeStr}`);

    // ── onProgress: sync state.json → DB on every batch ──────────────────────
    let lastPhase: string | null = null;
    let lastPhaseTotal = 0;
    // lockReleased guards against onProgress firing the release more than once.
    // Without it, a second UPLOAD progress call where currentLockHolder has already
    // been set to null by the next job would redundantly call processNextJob().
    let lockReleased = false;
    const onProgress = async (phase: string, current: number, total: number): Promise<void> => {
      if (signal.aborted) throw new Error(`Job ${jobId} was cancelled.`);

      // Phase-transition lines (GitLab-style separators)
      if (phase !== lastPhase) {
        if (lastPhase !== null) logger.info(lastPhase, `Phase DONE — ${lastPhaseTotal} items`);
        logger.info(phase, `Phase STARTED — ${total} items`);
        lastPhase = phase;
      }
      lastPhaseTotal = total;
      logger.info(phase, `${current}/${total}`);

      const phaseProgress = total > 0 ? current / total : 0;
      const offset = PHASE_OFFSETS[processKey]?.[phase] ?? 0;
      const width = PHASE_WIDTHS[processKey]?.[phase] ?? 0;
      const overall = Math.min(99, Math.floor(offset + phaseProgress * width));

      // Read state.json to derive rich metrics
      const stateData = new IngestionState(bookId, dataDir).initOrLoad();
      const questionsExtracted = stateData.questions.length;
      const questionsUploaded = stateData.questions.filter((q) => q.status === 'UPLOADED').length;
      const currentPage = Math.max(stateData.lastProcessedImageIndex, stateData.lastProcessedExtractionBatchIndex ?? -1) + 1;

      // Release lock exactly once when we reach UPLOAD so the next queued job
      // can start its processing phases concurrently with this job's uploads.
      if (phase === 'UPLOAD' && !lockReleased && currentLockHolder === jobId) {
        lockReleased = true;
        logger.info('UPLOAD', 'Reached UPLOAD phase — releasing queue lock for next job');
        currentLockHolder = null;
        processNextJob();
      }

      // Sync to DB — NEVER throws even if DB is down
      await syncProgressToDB(
        jobId,
        {
          currentPhase: phase,
          progress: Math.floor(phaseProgress * 100),
          overallProgress: overall,
          totalQuestions: questionsExtracted,
          questionsExtracted,
          questionsUploaded,
          currentPage,
          lastHeartbeatAt: new Date(),
        },
        3,
        true, // requireProcessing = true so ghost processes don't overwrite COMPLETED jobs
      );
    };

    logger.info('SYSTEM', 'Starting orchestrator run');
    await orchestrator.run({ signal }, onProgress);
    if (lastPhase !== null) logger.info(lastPhase, `Phase DONE — ${lastPhaseTotal} items`);

    // ── Job completed — write final status ────────────────────────────────────
    const finalState = new IngestionState(bookId, dataDir).initOrLoad();
    const totalExtracted = finalState.questions.length;
    const totalUploaded = finalState.questions.filter((q) => q.status === 'UPLOADED').length;

    await syncProgressToDB(
      jobId,
      {
        status: IngestionStatus.COMPLETED,
        currentPhase: 'COMPLETED',
        progress: 100,
        overallProgress: 100,
        totalQuestions: totalExtracted,
        questionsExtracted: totalExtracted,
        questionsUploaded: totalUploaded,
        processedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
      10, // More retries for the final status write
    );

    logger.info('COMPLETED', `Job completed. Extracted: ${totalExtracted}, Uploaded: ${totalUploaded}`);
  } catch (error: unknown) {
    if (signal.aborted) {
      logger.warn('SYSTEM', `Job ${jobId} cancelled by user`);
      await syncProgressToDB(jobId, { status: IngestionStatus.QUEUED }, 5);
    } else {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('FAILED', `Job failed: ${err.message}`);
      logger.error('FAILED', err.stack ?? err.message);
      await syncProgressToDB(
        jobId,
        {
          status: IngestionStatus.FAILED,
          errorLogs: err.stack ?? err.message,
        },
        10,
      );
    }
  } finally {
    clearInterval(heartbeatTimer);
    runningJobs.delete(jobId);
    logger.close();
  }
}

// ── Startup recovery ──────────────────────────────────────────────────────────

async function recoverOnStartup(): Promise<void> {
  console.log('[Startup] Beginning recovery scan...');

  // 1. Flush any pending sync entries first (final statuses written to disk when DB was down)
  const pending = pendingSyncStore.getAll();
  const pendingEntries = Object.entries(pending);
  if (pendingEntries.length > 0) {
    console.log(`[Startup] Flushing ${pendingEntries.length} pending sync entries...`);
    for (const [jobId, { data }] of pendingEntries) {
      try {
        await prisma.ingestionJob.update({ where: { id: jobId }, data });
        pendingSyncStore.delete(jobId);
        console.log(`[Startup] Flushed pending sync for job ${jobId}`);
      } catch (err: any) {
        if (err.code === 'P2025') {
          console.warn(`[Startup] Job ${jobId} not found in DB. Discarding pending sync.`);
          pendingSyncStore.delete(jobId);
        } else {
          console.error(`[Startup] Could not flush pending sync for ${jobId}:`, err);
        }
      }
    }
  }

  // 2. Re-trigger any jobs still stuck in PROCESSING (worker was killed mid-job)
  //    Note: jobs that were flushed to COMPLETED/FAILED above are now excluded.
  const stalledJobs = await prisma.ingestionJob.findMany({
    where: { status: IngestionStatus.PROCESSING },
  });

  // Collect stalled IDs into a Set so step 3 can explicitly exclude them,
  // making the dedup logic order-independent and immune to race between steps.
  const stalledIds = new Set<string>();

  if (stalledJobs.length > 0) {
    console.log(`[Startup] Found ${stalledJobs.length} stalled PROCESSING job(s). Re-triggering...`);
    for (const job of stalledJobs) {
      // Reset to QUEUED, then re-trigger (will read state.json checkpoint)
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: IngestionStatus.QUEUED },
      });
      stalledIds.add(job.id);
      // Queue the job instead of fire-and-forget
      jobQueue.push({ jobId: job.id });
    }
  }

  // 3. Re-queue any jobs that were already QUEUED — explicitly exclude stalled
  //    jobs we just reset so they are never added a second time.
  const queuedJobs = await prisma.ingestionJob.findMany({
    where: {
      status: IngestionStatus.QUEUED,
      ...(stalledIds.size > 0 && { id: { notIn: [...stalledIds] } }),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (queuedJobs.length > 0) {
    console.log(`[Startup] Found ${queuedJobs.length} QUEUED job(s). Adding to queue...`);
    for (const job of queuedJobs) {
      jobQueue.push({ jobId: job.id });
    }
  }

  if (stalledJobs.length > 0 || queuedJobs.length > 0) {
    processNextJob();
  }

  console.log('[Startup] Recovery scan complete.');
}

// ── Watchdog interval (60 s) ──────────────────────────────────────────────────

setInterval(async () => {
  // 1. Re-sync state.json → DB for all currently running jobs (handles DB coming back online)
  for (const [jobId, ctx] of runningJobs.entries()) {
    try {
      const stateData = new IngestionState(ctx.bookId, ctx.dataDir).initOrLoad();
      await prisma.ingestionJob.updateMany({
        where: { id: jobId, status: IngestionStatus.PROCESSING },
        data: {
          lastHeartbeatAt: new Date(),
          questionsExtracted: stateData.questions.length,
          questionsUploaded: stateData.questions.filter((q) => q.status === 'UPLOADED').length,
          currentPage: Math.max(stateData.lastProcessedImageIndex, stateData.lastProcessedExtractionBatchIndex ?? -1) + 1,
        },
      });
    } catch {
      // DB still down — will retry next interval
    }
  }

  // 2. Flush pending sync file (final statuses for jobs that already finished when DB was down)
  const pending = pendingSyncStore.getAll();
  for (const [jobId, { data }] of Object.entries(pending)) {
    try {
      await prisma.ingestionJob.update({ where: { id: jobId }, data });
      pendingSyncStore.delete(jobId);
      console.log(`[Watchdog] Flushed pending sync for job ${jobId}`);
    } catch (err: any) {
      if (err.code === 'P2025') {
        console.warn(`[Watchdog] Job ${jobId} not found in DB. Discarding pending sync.`);
        pendingSyncStore.delete(jobId);
      }
      // DB still down — try next interval
    }
  }
}, 60_000);

// ── Express HTTP server ───────────────────────────────────────────────────────

const app = express();
app.use(express.json());

/** Liveness probe — includes queue depth and lock holder for ops visibility */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    runningJobs: runningJobs.size,
    queuedJobs: jobQueue.length,
    lockHolder: currentLockHolder,
  });
});

/** Trigger a new ingestion job (fire-and-forget) */
app.post('/internal/run', (req, res) => {
  const { jobId, forcePhase } = req.body as { jobId?: string; forcePhase?: string };
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  if (runningJobs.has(jobId) || jobQueue.some((j) => j.jobId === jobId)) {
    console.log(`[IngestionWorker] Job ${jobId} is already running or queued, ignoring duplicate trigger.`);
    return res.status(409).json({ error: 'Job is already running or queued' });
  }

  console.log(`[IngestionWorker] Received trigger for job ${jobId}${forcePhase ? ` (forcePhase=${forcePhase})` : ''}`);

  jobQueue.push({ jobId, forcePhase });
  processNextJob();

  return res.status(200).json({ ok: true, message: 'Job queued' });
});

/** Cancel a running job */
app.post('/internal/cancel', (req, res) => {
  const { jobId } = req.body as { jobId?: string };
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const ctx = runningJobs.get(jobId);
  if (!ctx) {
    return res.status(404).json({ error: 'Job not running' });
  }

  ctx.abortController.abort();
  console.log(`[IngestionWorker] Cancelled job ${jobId}`);
  return res.status(200).json({ ok: true });
});

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[IngestionWorker] HTTP server listening on port ${PORT}`);

  // Wait briefly for DB connection to stabilise (especially on container startup ordering)
  await new Promise((r) => setTimeout(r, 3000));

  try {
    await prisma.$connect();
    await recoverOnStartup();
  } catch (err) {
    console.error('[IngestionWorker] DB connection failed on startup — recovery skipped:', err);
  }
});
