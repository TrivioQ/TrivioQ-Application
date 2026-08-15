import { Router, Request, Response } from 'express';
import { prisma, ProcessType, IngestionStatus } from '@trivioq/database';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── SSE connection cap (per job) ──────────────────────────────────────────────
const MAX_SSE_PER_JOB = 8;
const sseConnections = new Map<string, Set<Response>>();

// ── Worker URL ────────────────────────────────────────────────────────────────
// The ingestion worker runs as a separate container with its own HTTP server.
// Calls are internal (container-to-container) and never exposed to the internet.
const WORKER_INGESTION_URL = process.env.WORKER_INGESTION_URL ?? 'http://localhost:3014';

async function triggerWorkerJob(jobId: string, forcePhase?: string): Promise<void> {
  const res = await fetch(`${WORKER_INGESTION_URL}/internal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, forcePhase }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Worker responded ${res.status}: ${body}`);
  }
}

async function cancelWorkerJob(jobId: string): Promise<void> {
  try {
    await fetch(`${WORKER_INGESTION_URL}/internal/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
  } catch {
    // Best-effort — the job may have already finished
  }
}

// ── Multer (file upload) ──────────────────────────────────────────────────────
// Use a subdirectory within the ingestion volume so that both the temp file
// and final destination are on the same filesystem, avoiding EXDEV errors.
const ingestionRoot = () => path.resolve(process.cwd(), process.env.INGESTION_DIR ?? 'ingestion');
const multerTempDir = () => path.join(ingestionRoot(), '.tmp');

const MAX_PDF_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const tmpDir = multerTempDir();
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      cb(null, tmpDir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    },
  }),
  limits: { fileSize: MAX_PDF_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted.'));
    } else {
      cb(null, true);
    }
  },
});

/**
 * @route   GET /api/v1/admin/ingestion/jobs
 * @desc    Get all ingestion jobs with their status and progress
 * @access  Private (Admin Only)
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.ingestionJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { id: true, username: true, displayName: true } },
      },
    });

    return res.status(200).json({ success: true, data: jobs });
  } catch (error: any) {
    console.error('Error fetching ingestion jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/v1/admin/ingestion/jobs
 * @desc    Upload a PDF and create a new ingestion job, then trigger the worker
 * @access  Private (Admin Only)
 */
router.post('/jobs', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { processType, topic, categorySlugs, extractionSpecialInstruction, enhancementSpecialInstruction, classificationSpecialInstruction, summarizationSpecialInstruction, pagesFrom, pagesTo, scoutModelId, extractionModelId, enhancementModelId, generationModelId, summarizationModelId } = req.body;

    const parsedCategorySlugs = categorySlugs ? JSON.parse(categorySlugs) : undefined;

    let pages;
    if (pagesFrom || pagesTo) {
      pages = {
        ...(pagesFrom && { from: parseInt(pagesFrom, 10) }),
        ...(pagesTo && { to: parseInt(pagesTo, 10) }),
      };
    }

    const modelOverrides: Record<string, string> = {};
    if (scoutModelId) modelOverrides.scout = scoutModelId;
    if (extractionModelId) modelOverrides.extraction = extractionModelId;
    if (enhancementModelId) modelOverrides.enhancement = enhancementModelId;
    if (generationModelId) modelOverrides.generation = generationModelId;
    if (summarizationModelId) modelOverrides.summarization = summarizationModelId;

    const manifestData = {
      processType,
      topic,
      categorySlugs: parsedCategorySlugs,
      extractionSpecialInstruction,
      enhancementSpecialInstruction,
      classificationSpecialInstruction,
      summarizationSpecialInstruction,
      pages,
      ...(Object.keys(modelOverrides).length > 0 && { modelOverrides }),
    };

    const dbProcessType = processType === 'quiz-generation' ? ProcessType.QUIZ_GENERATION : ProcessType.QUESTION_EXTRACTION;

    // Create the DB record first to obtain the UUID that becomes the bookId/directory name
    const newJob = await prisma.ingestionJob.create({
      data: {
        processType: dbProcessType,
        status: IngestionStatus.QUEUED,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        storagePath: '', // updated below once directory is known
        manifestData,
        adminId: (req as any).user?.id,
      },
    });

    const bookId = newJob.id;
    const bookDir = path.join(ingestionRoot(), bookId);

    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }

    const targetPdfPath = path.join(bookDir, req.file.originalname);
    // Use async FS calls so these operations don't block the event loop
    // while moving potentially large PDF files.
    await fs.promises.rename(req.file.path, targetPdfPath);

    // Save manifest file for local debugging
    await fs.promises.writeFile(path.join(bookDir, 'manifest.json'), JSON.stringify({ bookId, ...manifestData }, null, 2));

    await prisma.ingestionJob.update({
      where: { id: bookId },
      data: { storagePath: targetPdfPath },
    });

    // Trigger the worker as a genuine fire-and-forget — respond to the browser
    // immediately after the DB record is committed. The worker runs async and
    // the frontend polls job status via the ingestion dashboard.
    triggerWorkerJob(bookId).catch((err) => console.error(`[ingestion] Failed to trigger worker for job ${bookId}:`, err));

    return res.status(201).json({ success: true, data: { id: bookId } });
  } catch (error: any) {
    // Return a descriptive 400 for upload-level violations (file too large, wrong type)
    // instead of leaking a generic 500.
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum allowed size is ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.` });
    }
    if (error.message === 'Only PDF files are accepted.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating ingestion job:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/v1/admin/ingestion/jobs/:id
 * @desc    Get details of a specific ingestion job
 * @access  Private (Admin Only)
 */
router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.ingestionJob.findUnique({
      where: { id: req.params.id },
      include: {
        admin: { select: { id: true, username: true, displayName: true } },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ success: true, data: job });
  } catch (error: any) {
    console.error('Error fetching ingestion job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/v1/admin/ingestion/jobs/:id/artifact
 * @desc    Get or download the state.json artifact for an ingestion job
 * @access  Private (Admin Only)
 */
router.get('/jobs/:id/artifact', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const download = req.query.download === 'true';

    const job = await prisma.ingestionJob.findUnique({
      where: { id },
      select: { storagePath: true },
    });

    if (!job || !job.storagePath) {
      return res.status(404).json({ error: 'Job not found or has no storage path' });
    }

    const artifactPath = path.join(path.dirname(job.storagePath), 'data', `${id}_state.json`);

    if (!fs.existsSync(artifactPath)) {
      return res.status(404).json({ error: `Artifact (${id}_state.json) not found for this job` });
    }

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="job-${id}-state.json"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return fs.createReadStream(artifactPath).pipe(res);
    } else {
      res.setHeader('Content-Type', 'application/json');
      return fs.createReadStream(artifactPath).pipe(res);
    }
  } catch (error: any) {
    console.error('Error fetching artifact:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/v1/admin/ingestion/jobs/:id/logs
 * @desc    Stream the job's workflow.log as Server-Sent Events (text/event-stream)
 * @access  Private (Admin Only)
 */
router.get('/jobs/:id/logs', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Resolve log path from DB — same pattern as the artifact endpoint; never
  // accept a user-supplied filename (path-injection safe).
  let storagePath: string | null = null;
  try {
    const job = await prisma.ingestionJob.findUnique({
      where: { id },
      select: { storagePath: true, status: true },
    });
    if (!job || !job.storagePath) {
      return res.status(404).json({ error: 'Job not found or has no storage path' });
    }
    storagePath = job.storagePath;
  } catch (error: any) {
    console.error('Error setting up ingestion log stream:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Connection cap
  const conns = sseConnections.get(id) ?? new Set<Response>();
  if (conns.size >= MAX_SSE_PER_JOB) {
    return res.status(503).json({ error: 'Too many concurrent log streams for this job' });
  }
  conns.add(res);
  sseConnections.set(id, conns);

  const dataDir = path.join(path.dirname(storagePath), 'data');
  const logPath = path.join(dataDir, 'workflow.log');
  const REPLAY_TAIL_CAP = 256 * 1024;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  let fd: number | null = null;
  let offset = 0;
  let inode: number | null = null;
  let lastSize = 0;
  let waitingEmitted = false;

  const sse = (event: string | null, data: unknown) => {
    const payload = event ? `event: ${event}\n` : '';
    res.write(`${payload}data: ${JSON.stringify(data)}\n\n`);
  };

  const poll = () => {
    if (closed) return;
    try {
      if (!fs.existsSync(logPath)) {
        if (!waitingEmitted) {
          sse('status', { status: 'waiting', message: 'Log file not yet created' });
          waitingEmitted = true;
        }
        return;
      }
      waitingEmitted = false;
      const stat = fs.statSync(logPath);

      // Rotation detection (inode changed) — reopen from 0.
      if (inode !== null && stat.ino !== inode) {
        if (fd !== null) {
          try {
            fs.closeSync(fd);
          } catch {}
        }
        fd = fs.openSync(logPath, 'r');
        offset = 0;
        inode = stat.ino;
        lastSize = 0;
        sse('rotated', { reason: 'inode' });
      } else if (fd === null) {
        fd = fs.openSync(logPath, 'r');
        inode = stat.ino;
        offset = 0;
        lastSize = 0;
      }

      // Tail-cap the initial replay to the last 256 KB (whole-line aligned).
      if (offset === 0 && stat.size > REPLAY_TAIL_CAP) {
        offset = stat.size - REPLAY_TAIL_CAP;
        const headBuf = Buffer.alloc(512);
        const n = fs.readSync(fd, headBuf, 0, 512, offset);
        const nlIdx = headBuf.slice(0, n).indexOf(0x0a);
        if (nlIdx >= 0) offset += nlIdx + 1;
        sse('truncated', { skipped: true });
      }

      if (stat.size > lastSize) {
        const len = stat.size - offset;
        if (len > 0) {
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, offset);
          offset = stat.size;
          for (const line of buf.toString('utf8').split('\n')) {
            if (!line.trim()) continue;
            res.write(`data: ${line}\n\n`); // JSONL: one line = one event
          }
        }
        lastSize = stat.size;
      } else if (stat.size < lastSize) {
        // Truncated (retry rotated to .1). Reset.
        offset = 0;
        lastSize = stat.size;
        sse('rotated', { reason: 'truncate' });
      }
    } catch (err) {
      console.error('[SSE logs] poll error:', err);
    }
  };

  // fs.watch is an optimization; the 1s interval is the source of truth (fs.watch
  // drops events on some Docker/macOS bind mounts).
  let watcher: fs.FSWatcher | null = null;
  const attachWatcher = () => {
    try {
      watcher = fs.watch(logPath, () => void poll());
      watcher.on('error', () => {
        watcher = null;
      });
    } catch {
      watcher = null;
    }
  };
  if (fs.existsSync(logPath)) attachWatcher();

  const interval = setInterval(() => void poll(), 1000);
  const keepAlive = setInterval(() => {
    if (!closed) res.write(':\n\n');
  }, 15000);

  // Done detection — independent 5s DB poll (decoupled from file ticks).
  const dbPoll = setInterval(async () => {
    if (closed) return;
    try {
      const job = await prisma.ingestionJob.findUnique({ where: { id }, select: { status: true } });
      if (!job) {
        sse('done', { status: 'DELETED' });
        cleanup();
        return;
      }
      if (job.status === IngestionStatus.COMPLETED || job.status === IngestionStatus.FAILED || job.status === IngestionStatus.PAUSED) {
        // Drain any final log lines written just before the job reached a
        // terminal state before closing the stream.  Without this, the 5 s DB
        // poll can fire and close the connection while the 1 s file poll still
        // has unread bytes, causing the last batch of log entries to be lost.
        poll();
        sse('done', { status: job.status });
        cleanup();
      }
    } catch (err: any) {
      if (err?.code === 'P2025') {
        sse('done', { status: 'DELETED' });
        cleanup();
      }
    }
  }, 5000);

  // Re-attach watcher once the file exists (if it didn't at connect time).
  const watcherAttach = setInterval(() => {
    if (watcher || closed) return;
    if (fs.existsSync(logPath)) attachWatcher();
  }, 2000);

  // Initial flush — resolves the file and emits the initial tail snapshot before
  // the DB poll gets a chance to fire a terminal `done` event.
  void poll();

  function cleanup() {
    if (closed) return;
    closed = true;
    watcher?.close();
    clearInterval(interval);
    clearInterval(keepAlive);
    clearInterval(dbPoll);
    clearInterval(watcherAttach);
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    const set = sseConnections.get(id);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseConnections.delete(id);
    }
    res.end();
  }

  req.on('close', cleanup);
});

/**
 * @route   POST /api/v1/admin/ingestion/jobs/:id/retry
 * @desc    Retry a failed/completed job, optionally resetting to a specific phase
 * @access  Private (Admin Only)
 */
router.post('/jobs/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { forcePhase } = req.body;

    const job = await prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === IngestionStatus.PROCESSING) {
      await cancelWorkerJob(id);
    }

    await prisma.ingestionJob.update({
      where: { id },
      data: { status: IngestionStatus.QUEUED, errorLogs: null },
    });

    await triggerWorkerJob(id, forcePhase);

    return res.status(200).json({ success: true, message: 'Job queued for retry' });
  } catch (error: any) {
    console.error('Error retrying ingestion job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/v1/admin/ingestion/jobs/:id/pause
 * @desc    Pause a running job
 * @access  Private (Admin Only)
 */
router.post('/jobs/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== IngestionStatus.PROCESSING) {
      return res.status(400).json({ error: 'Job is not processing' });
    }

    await cancelWorkerJob(id);

    await prisma.ingestionJob.update({
      where: { id },
      data: { status: IngestionStatus.PAUSED },
    });

    return res.status(200).json({ success: true, message: 'Job paused' });
  } catch (error: any) {
    console.error('Error pausing ingestion job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/v1/admin/ingestion/jobs/:id
 * @desc    Delete an ingestion job, cancel it if running, and remove its files
 * @access  Private (Admin Only)
 */
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Best-effort cancel if running
    await cancelWorkerJob(id);

    // Remove files
    if (job.storagePath) {
      const bookDir = path.dirname(job.storagePath);
      if (fs.existsSync(bookDir)) {
        fs.rmSync(bookDir, { recursive: true, force: true });
      }
    }

    await prisma.ingestionJob.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'Job deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting ingestion job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const ingestionRouter = router;
