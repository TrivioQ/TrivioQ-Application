import { Router, Request, Response } from 'express';
import { prisma, ProcessType, IngestionStatus } from '@trivioq/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const ingestionQueue = new Queue('pdf-ingestion', { connection: connection as any });

// Multer temp dir: use a subdirectory within the ingestion volume so that
// both the temp file and the final destination are on the same filesystem.
// This avoids EXDEV "cross-device link not permitted" errors when renaming
// across Docker volume boundaries (e.g. /tmp → /app/ingestion on a different device).
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
 * @desc    Upload a PDF and create a new ingestion job
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

    // We generate a UUID for the bookId (which will be the DB job ID)
    // To do this reliably before moving the file, let's create the DB record first
    const newJob = await prisma.ingestionJob.create({
      data: {
        processType: dbProcessType,
        status: IngestionStatus.QUEUED,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        storagePath: '', // We will update this
        manifestData: manifestData,
        adminId: (req as any).user?.id, // assuming firebase middleware attaches user
      },
    });

    const bookId = newJob.id;
    const bookDir = path.join(ingestionRoot(), bookId);

    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }

    const targetPdfPath = path.join(bookDir, req.file.originalname);

    // Move from temp to actual target
    fs.renameSync(req.file.path, targetPdfPath);

    // Save manifest file in folder just in case (optional, but good for local debugging)
    fs.writeFileSync(path.join(bookDir, 'manifest.json'), JSON.stringify({ bookId, ...manifestData }, null, 2));

    await prisma.ingestionJob.update({
      where: { id: bookId },
      data: { storagePath: targetPdfPath },
    });

    // Add to BullMQ — remove any stale job with this ID first (e.g. from a
    // previous failed attempt) so BullMQ does not silently ignore the add.
    const existingBullJob = await ingestionQueue.getJob(bookId);
    if (existingBullJob) {
      await existingBullJob.remove();
    }
    await ingestionQueue.add(
      'pdf-ingestion',
      { jobId: bookId },
      { jobId: bookId, removeOnFail: true }, // removeOnFail prevents stale IDs blocking future retries
    );

    return res.status(201).json({ success: true, data: { id: bookId } });
  } catch (error: any) {
    console.error('Error creating ingestion job:', error);
    // Cleanup temp file if it exists
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
 * @desc    Retry a failed job or resume from a specific phase
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

    // BullMQ silently ignores add() if a job with the same ID already exists
    // (even in failed/completed state). Explicitly remove the stale BullMQ job
    // first so the worker actually picks up the new entry.
    try {
      const existingBullJob = await ingestionQueue.getJob(id);
      if (existingBullJob) {
        await existingBullJob.remove();
      }
    } catch (removeErr) {
      console.warn(`[RetryRoute] Could not remove existing BullMQ job ${id}:`, removeErr);
    }

    await ingestionQueue.add('pdf-ingestion', { jobId: id, forcePhase }, { jobId: id, removeOnFail: true });

    return res.status(200).json({ success: true, message: 'Job queued for retry' });
  } catch (error: any) {
    console.error('Error retrying ingestion job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/v1/admin/ingestion/jobs/:id
 * @desc    Delete an ingestion job and its files
 * @access  Private (Admin Only)
 */
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.ingestionJob.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Try to remove BullMQ job
    try {
      const bullJob = await ingestionQueue.getJob(id);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (e) {
      console.log('Error removing bull job', e);
    }

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
