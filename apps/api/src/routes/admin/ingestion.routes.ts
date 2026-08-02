import { Router, Request, Response } from 'express';
import { prisma, ProcessType, IngestionStatus } from '@trivioq/database';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

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

    const { processType, topic, categorySlugs, extractionSpecialInstruction, enhancementSpecialInstruction, classificationSpecialInstruction, summarizationSpecialInstruction, pagesFrom, pagesTo, scoutProvider, extractionProvider, enhancementProvider, generationProvider, summarizationProvider } = req.body;

    const parsedCategorySlugs = categorySlugs ? JSON.parse(categorySlugs) : undefined;

    let pages;
    if (pagesFrom || pagesTo) {
      pages = {
        ...(pagesFrom && { from: parseInt(pagesFrom, 10) }),
        ...(pagesTo && { to: parseInt(pagesTo, 10) }),
      };
    }

    const providers: Record<string, string> = {};
    if (scoutProvider) providers.scout = scoutProvider;
    if (extractionProvider) providers.extraction = extractionProvider;
    if (enhancementProvider) providers.enhancement = enhancementProvider;
    if (generationProvider) providers.generation = generationProvider;
    if (summarizationProvider) providers.summarization = summarizationProvider;

    const manifestData = {
      processType,
      topic,
      categorySlugs: parsedCategorySlugs,
      extractionSpecialInstruction,
      enhancementSpecialInstruction,
      classificationSpecialInstruction,
      summarizationSpecialInstruction,
      pages,
      ...(Object.keys(providers).length > 0 && { providers }),
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
    fs.renameSync(req.file.path, targetPdfPath);

    // Save manifest file for local debugging
    fs.writeFileSync(path.join(bookDir, 'manifest.json'), JSON.stringify({ bookId, ...manifestData }, null, 2));

    await prisma.ingestionJob.update({
      where: { id: bookId },
      data: { storagePath: targetPdfPath },
    });

    // Trigger the worker — fire-and-forget via HTTP
    await triggerWorkerJob(bookId);

    return res.status(201).json({ success: true, data: { id: bookId } });
  } catch (error: any) {
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
      return res.status(400).json({ error: 'Job is already processing' });
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
