import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma, ProcessType, IngestionStatus } from '@trivioq/database';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { pdfToImage } from '../ai-question-ingestion/utils/pdf-to-image';
import { IngestionOrchestrator } from '../ai-question-ingestion/orchestrator';
import { IngestionState } from '../ai-question-ingestion/utils/state-manager';
import type { ManifestJson } from '../ai-question-ingestion/processes/process.interface';
import { getSetting, getSettingNumber } from '../utils/settings';
import type { AIProviderName } from '../ai-question-ingestion/providers';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export interface PdfIngestionJob {
  jobId: string;
  forcePhase?: 'SCOUT' | 'EXTRACTION' | 'ENHANCEMENT' | 'UPLOAD';
}

const ingestionWorker = new Worker<PdfIngestionJob>(
  'pdf-ingestion',
  async (job: Job<PdfIngestionJob>) => {
    const { jobId, forcePhase } = job.data;
    console.log(`[IngestionWorker] Starting ingestion job ${jobId}`);

    const dbJob = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!dbJob) {
      throw new Error(`Ingestion job ${jobId} not found in database.`);
    }

    if (dbJob.status === IngestionStatus.PAUSED || dbJob.status === IngestionStatus.COMPLETED) {
      console.log(`[IngestionWorker] Job ${jobId} is ${dbJob.status}, skipping execution.`);
      return;
    }

    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: { status: IngestionStatus.PROCESSING, errorLogs: null },
    });

    try {
      const bookId = dbJob.id;
      const pdfPath = dbJob.storagePath;
      const dataDir = path.join(path.dirname(pdfPath), 'data');
      const pagesDir = path.join(dataDir, 'pages');

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Reset state if forcePhase is provided
      if (forcePhase) {
        const state = new IngestionState(bookId, dataDir);
        state.resetToPhase(forcePhase);
        console.log(`[IngestionWorker] Reset state for job ${jobId} to phase ${forcePhase}`);
      }

      const manifestData = ((dbJob.manifestData as unknown as ManifestJson) || {}) as Partial<ManifestJson>;
      const { pages } = manifestData;

      // ── Image Validation and Conversion ──
      let expectedPages = 0;
      if (pages?.from !== undefined && pages?.to !== undefined) {
        expectedPages = pages.to - pages.from + 1;
      } else {
        const pdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();
        const start = pages?.from ?? 1;
        const end = pages?.to ?? totalPages;
        expectedPages = end - start + 1;
      }

      let imagePaths: string[] = [];
      let needConversion = true;

      if (fs.existsSync(pagesDir)) {
        const existingFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (existingFiles.length === expectedPages && expectedPages > 0) {
          console.log(`[IngestionWorker] Found ${expectedPages} existing images, skipping PDF conversion.`);
          needConversion = false;
          // Sort numerically to maintain order
          imagePaths = existingFiles.map((f) => path.join(pagesDir, f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        } else {
          console.log(`[IngestionWorker] Image count mismatch (expected ${expectedPages}, found ${existingFiles.length}). Re-converting.`);
          fs.rmSync(pagesDir, { recursive: true, force: true });
          fs.mkdirSync(pagesDir, { recursive: true });
        }
      } else {
        fs.mkdirSync(pagesDir, { recursive: true });
      }

      if (needConversion) {
        console.log(`[IngestionWorker] Converting PDF to images for job ${jobId}...`);
        imagePaths = await pdfToImage(pdfPath, pagesDir, {
          fromPage: pages?.from,
          toPage: pages?.to,
        });
      }

      if (imagePaths.length === 0) {
        throw new Error('PDF produced no images.');
      }

      // ── Orchestrator ──
      // Default to processType from DB, else use manifest, else question-extraction
      const pTypeStr = dbJob.processType === ProcessType.QUIZ_GENERATION ? 'quiz-generation' : 'question-extraction';

      const scoutProvider = (await getSetting('ingestion_scout_provider', 'google')) as AIProviderName;
      const extractionProvider = (await getSetting('ingestion_extraction_provider', 'google')) as AIProviderName;
      const enhancementProvider = (await getSetting('ingestion_enhancement_provider', 'google')) as AIProviderName;
      const summarizationProvider = (await getSetting('ingestion_summarization_provider', 'google')) as AIProviderName;
      const generationProvider = (await getSetting('ingestion_generation_provider', 'google')) as AIProviderName;

      const scoutModel = await getSetting('ingestion_scout_model', 'gemini-1.5-flash');
      const extractionModel = await getSetting('ingestion_extraction_model', 'gemini-1.5-pro');
      const enhancementModel = await getSetting('ingestion_enhancement_model', 'gemini-1.5-pro');
      const summarizationModel = await getSetting('ingestion_summarization_model', 'gemini-1.5-flash');
      const generationModel = await getSetting('ingestion_generation_model', 'gemini-1.5-pro');

      const scoutDelay = await getSettingNumber('ingestion_scout_call_delay_sec', 10);
      const extractionDelay = await getSettingNumber('ingestion_extraction_call_delay_sec', 10);
      const enhancementDelay = await getSettingNumber('ingestion_enhancement_call_delay_sec', 10);
      const summarizationDelay = await getSettingNumber('ingestion_summarization_call_delay_sec', 10);
      const generationDelay = await getSettingNumber('ingestion_generation_call_delay_sec', 10);

      const scoutTemp = await getSettingNumber('ingestion_scout_temperature', 0.2);
      const extractionTemp = await getSettingNumber('ingestion_extraction_temperature', 0.2);
      const enhancementTemp = await getSettingNumber('ingestion_enhancement_temperature', 0.7);
      const summarizationTemp = await getSettingNumber('ingestion_summarization_temperature', 0.2);
      const generationTemp = await getSettingNumber('ingestion_generation_temperature', 0.7);

      const extractionBatchSize = await getSettingNumber('ingestion_extraction_batch_size', 1);
      const enhancementConcurrency = await getSettingNumber('ingestion_enhancement_concurrency', 10);

      const orchestrator = new IngestionOrchestrator(bookId, imagePaths, {
        outputDir: dataDir,
        processType: manifestData.processType ?? pTypeStr,
        topic: manifestData.topic ?? '',
        categorySlugs: manifestData.categorySlugs ?? [],
        providers: {
          scout: manifestData.providers?.scout ?? scoutProvider,
          extraction: manifestData.providers?.extraction ?? extractionProvider,
          enhancement: manifestData.providers?.enhancement ?? enhancementProvider,
          summarization: manifestData.providers?.summarization ?? summarizationProvider,
          generation: manifestData.providers?.generation ?? generationProvider,
        },
        models: {
          scout: scoutModel,
          extraction: extractionModel,
          enhancement: enhancementModel,
          summarization: summarizationModel,
          generation: generationModel,
        },
        callDelays: {
          scout: scoutDelay,
          extraction: extractionDelay,
          enhancement: enhancementDelay,
          summarization: summarizationDelay,
          generation: generationDelay,
        },
        temperatures: {
          scout: scoutTemp,
          extraction: extractionTemp,
          enhancement: enhancementTemp,
          summarization: summarizationTemp,
          generation: generationTemp,
        },
        extractionBatchSize,
        enhancementConcurrency,
        extractionSpecialInstruction: manifestData.extractionSpecialInstruction,
        enhancementSpecialInstruction: manifestData.enhancementSpecialInstruction,
        classificationSpecialInstruction: manifestData.classificationSpecialInstruction,
        summarizationSpecialInstruction: manifestData.summarizationSpecialInstruction,
      });

      const onProgress = async (phase: string, current: number, total: number) => {
        const progressPercentage = total > 0 ? Math.floor((current / total) * 100) : 0;

        await prisma.ingestionJob.update({
          where: { id: jobId },
          data: {
            currentPhase: phase,
            progress: progressPercentage,
          },
        });

        await job.updateProgress(progressPercentage);
      };

      await orchestrator.run(undefined, onProgress);

      const finalState = new IngestionState(bookId, dataDir).initOrLoad();
      const totalExtracted = finalState.questions.length;

      await prisma.ingestionJob.update({
        where: { id: jobId },
        data: {
          status: IngestionStatus.COMPLETED,
          currentPhase: 'COMPLETED',
          progress: 100,
          totalQuestions: totalExtracted,
          processedAt: new Date(),
        },
      });

      console.log(`[IngestionWorker] Job ${jobId} completed successfully.`);
    } catch (error: any) {
      console.error(`[IngestionWorker] Job ${jobId} failed:`, error);

      await prisma.ingestionJob.update({
        where: { id: jobId },
        data: {
          status: IngestionStatus.FAILED,
          errorLogs: error instanceof Error ? error.stack || error.message : String(error),
        },
      });

      throw error;
    }
  },
  {
    connection: connection as any,
    concurrency: 1, // Crucial: Only 1 PDF processed at a time across the system
  },
);

ingestionWorker.on('failed', (job, err) => {
  console.error(`Ingestion job ${job?.id} failed with error:`, err);
});

console.log('PDF Ingestion worker listening to "pdf-ingestion" queue...');
