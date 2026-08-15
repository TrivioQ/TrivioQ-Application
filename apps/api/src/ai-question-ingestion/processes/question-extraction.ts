import { prisma } from '@trivioq/database';
import { IngestionState, Question } from '../utils/state-manager';
import { checkIsDuplicate } from '../../utils/check-is-duplicate';
import { checkPendingDuplicate } from '../../utils/check-pending-duplicate';
import { shuffleArray } from '../../utils/shuffle';
import { reportError } from '../../utils/error-reporter';
import fs from 'fs';
import type { AIProvider } from '../providers';
import { resolveProvider } from '../providers/registry';
import { buildExtractionPrompt, buildEnhancementPrompt, KEY_EXTRACTION_PROMPT, buildClassificationPrompt } from '../prompts';
import { sanitiseDifficulty, sanitiseAgeRating } from '../utils/sanitise';

// ── Re-exports (kept for backwards-compatibility with existing callers) ────────
export type { ExtractedQuestion, ExtractedAnswerKey, EnhancementResult } from '../providers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageType = 'QUESTIONS' | 'QUESTIONS_WITH_KEYS' | 'QUESTIONS_WITH_KEY_UNDERNEATH' | 'OTHER';

// ── Configuration ─────────────────────────────────────────────────────────────

const DEFAULT_CALL_DELAY = 10;

// ── Orchestrator ──────────────────────────────────────────────────────────────

import { OrchestratorConfig, IngestionProcess } from './process.interface';

export class QuestionExtractionProcess implements IngestionProcess {
  private readonly state: IngestionState;
  /** Provider used in Phase 1 — image classification. */
  private scoutProvider?: AIProvider;
  /** Provider used in Phase 2 — question extraction. */
  private extractionProvider?: AIProvider;
  /** Provider used in Phase 3 — question enhancement + difficulty inference. */
  private enhancementProvider?: AIProvider;
  private readonly extractionSpecialInstruction?: string;
  private readonly enhancementSpecialInstruction?: string;
  private readonly classificationSpecialInstruction?: string;
  private readonly callDelayMs: { scout: number; extraction: number; enhancement: number };

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: OrchestratorConfig,
  ) {
    this.state = new IngestionState(bookId, config.outputDir);

    this.extractionSpecialInstruction = config.extractionSpecialInstruction;
    this.enhancementSpecialInstruction = config.enhancementSpecialInstruction;
    this.classificationSpecialInstruction = config.classificationSpecialInstruction;

    this.callDelayMs = {
      scout: (config.callDelays?.scout ?? DEFAULT_CALL_DELAY) * 1000,
      extraction: (config.callDelays?.extraction ?? DEFAULT_CALL_DELAY) * 1000,
      enhancement: (config.callDelays?.enhancement ?? DEFAULT_CALL_DELAY) * 1000,
    };
  }

  private availableCategories: { slug: string; name: string }[] = [];
  private lastCallTime = 0;

  private logInfo(phase: string, message: string): void {
    if (this.config.logger) {
      this.config.logger.info(phase.toUpperCase(), message);
    } else {
      console.log(`[${phase}] ${message}`);
    }
  }

  private logError(phase: string, message: string, error?: any): void {
    if (this.config.logger) {
      this.config.logger.error(phase.toUpperCase(), message);
      if (error) this.config.logger.error(phase.toUpperCase(), String(error));
    } else {
      console.error(`[${phase}] ${message}`, error || '');
    }
  }

  private async delayIfNeeded(phase: 'scout' | 'extraction' | 'enhancement'): Promise<void> {
    if (this.lastCallTime > 0) {
      const elapsed = Date.now() - this.lastCallTime;
      const delay = this.callDelayMs[phase] - elapsed;
      if (delay > 0) {
        const prefix = phase.charAt(0).toUpperCase() + phase.slice(1);
        this.logInfo(prefix, `Delaying ${Math.ceil(delay / 1000)} seconds to rate-limit AI calls...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private recordCallTime(): void {
    this.lastCallTime = Date.now();
  }

  async run(options?: { reuploadOnly?: boolean; signal?: AbortSignal }, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    this.state.initOrLoad();

    // Resolve providers from the registry (async — DB + key decryption). Done
    // here, in run(), rather than in the sync constructor so the registry's
    // 60s cache is hit and the constructor stays side-effect-free.
    this.scoutProvider = await resolveProvider(this.config.modelOverrides?.scout ?? this.config.stageModelIds?.scout ?? '');
    this.extractionProvider = await resolveProvider(this.config.modelOverrides?.extraction ?? this.config.stageModelIds?.extraction ?? '');
    this.enhancementProvider = await resolveProvider(this.config.modelOverrides?.enhancement ?? this.config.stageModelIds?.enhancement ?? '');

    this.logInfo('QuestionExtraction', `Starting ingestion for ${this.imagePaths.length} images`);
    this.logInfo('QuestionExtraction', `Categories: ${(this.config.categorySlugs ?? []).join(', ')}`);
    this.logInfo('QuestionExtraction', `Providers — scout: ${this.scoutProvider!.model}, extraction: ${this.extractionProvider!.model}, enhancement: ${this.enhancementProvider!.model}`);
    if (this.extractionSpecialInstruction || this.enhancementSpecialInstruction || this.classificationSpecialInstruction) {
      const ei = this.extractionSpecialInstruction?.slice(0, 80);
      const hi = this.enhancementSpecialInstruction?.slice(0, 80);
      const ci = this.classificationSpecialInstruction?.slice(0, 80);
      this.logInfo('QuestionExtraction', `Special instructions — classification: ${ci ?? 'none'}, extraction: ${ei ?? 'none'}, enhancement: ${hi ?? 'none'}`);
    }

    this.availableCategories = await prisma.category.findMany({
      select: { slug: true, name: true },
    });
    this.logInfo('QuestionExtraction', `Fetched ${this.availableCategories.length} categories from DB`);

    if (this.availableCategories.length === 0) {
      throw new Error('No categories found in the database. Please run the database seeder first (`pnpm --filter @trivioq/database seed-categories`).');
    }

    if (options?.reuploadOnly) {
      this.logInfo('QuestionExtraction', 'Reupload mode: preparing questions for upload...');
      const stateData = this.state.initOrLoad();
      for (const q of stateData.questions) {
        if (q.status === 'UPLOADED' || q.status === 'READY_FOR_UPLOAD') {
          this.state.updateStatus(q.id, 'READY_FOR_UPLOAD');
        }
      }
      await this.uploadPhase(options?.signal, onProgress);
    } else {
      await this.runScoutPhase(options?.signal, onProgress);
      await this.runExtractionPhase(options?.signal, onProgress);
      await this.runEnhancementPhase(options?.signal, onProgress);
      await this.uploadPhase(options?.signal, onProgress);
    }
    this.logInfo('QuestionExtraction', 'Ingestion complete');
  }

  // ── Phase 1: Scout ────────────────────────────────────────────────────────

  private async runScoutPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const startIndex = stateData.lastProcessedImageIndex + 1;
    const temperature = this.config.temperatures?.scout;

    this.logInfo('Scout', `Starting from image ${startIndex + 1}`);
    this.logInfo('Scout', `Stage Config — Provider: ${this.scoutProvider!.constructor.name}, Model: ${this.scoutProvider!.model}, Temperature: ${temperature ?? 'default'}, Delay: ${this.callDelayMs.scout}ms`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      await onProgress?.('SCOUT', i + 1, this.imagePaths.length);
      const imagePath = this.imagePaths[i];

      try {
        const image = this.imageToBase64(imagePath);
        const stateData = this.state.initOrLoad();
        const existingMeta = (stateData.metadata as Record<string, unknown>) ?? {};
        const imageClassifications = (existingMeta.imageClassifications as Record<string, ImageType>) ?? {};

        await this.delayIfNeeded('scout');
        this.logInfo('Scout', `Classifying image ${i + 1}...`);
        let classification: ImageType;
        try {
          const classificationPrompt = buildClassificationPrompt(this.classificationSpecialInstruction);
          const res = await this.scoutProvider!.classifyImage(image, classificationPrompt, { temperature, signal, logger: this.config.logger, loggingPhase: 'SCOUT' });
          classification = res.classification;
        } finally {
          this.recordCallTime();
        }
        imageClassifications[imagePath] = classification;

        this.state.updateMetadata({ ...existingMeta, imageClassifications });
        this.state.setLastProcessedImageIndex(i);

        this.logInfo('Scout', `Image ${i + 1} classified as ${classification} [${i + 1}/${this.imagePaths.length}]`);
      } catch (error) {
        if (signal?.aborted) throw error;
        this.logError('Scout', `Error processing image ${imagePath}:`, error);
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'scout',
          imageIndex: i,
          imagePath,
        });
        // Continue — fault tolerant
      }
    }
  }

  // ── Phase 2: Extraction ───────────────────────────────────────────────────

  private async runExtractionPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const imageClassifications = (stateData.metadata?.imageClassifications as Record<string, ImageType>) ?? {};
    const temperature = this.config.temperatures?.extraction;
    const batchSize = this.config.extractionBatchSize ?? 1;

    // ── Pass 1: Extract Keys from 'QUESTIONS_WITH_KEYS' pages ──
    const keyPages: string[] = [];
    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification === 'QUESTIONS_WITH_KEYS') keyPages.push(imagePath);
    }

    if (keyPages.length > 0) {
      this.logInfo('Extraction', `Pass 1: Extracting answer keys from ${keyPages.length} boundary pages...`);
      for (const keyPagePath of keyPages) {
        try {
          const stateDataMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const processedKeyPages = (stateDataMeta.processedKeyPages as string[]) ?? [];

          // Backward compatibility check for already extracted keys
          const match = keyPagePath.match(/page\.(\d+)\./);
          const pageNum = match ? parseInt(match[1], 10) : -1;
          const existingAKsInitial = (stateDataMeta.answerKeys as any[]) ?? [];
          const alreadyExtracted = existingAKsInitial.some((ak: any) => ak.pageNumber === pageNum);

          if (processedKeyPages.includes(keyPagePath) || alreadyExtracted) {
            this.logInfo('Extraction', `Skipping already extracted key page ${keyPagePath}`);
            continue;
          }

          const image = this.imageToBase64(keyPagePath);
          await this.delayIfNeeded('extraction');

          this.logInfo('Extraction', `Extracting keys from ${keyPagePath}...`);
          let extracted;
          try {
            extracted = await this.extractionProvider!.extractFromImages([image], KEY_EXTRACTION_PROMPT, { temperature, signal, logger: this.config.logger, loggingPhase: 'EXTRACTION' });
          } finally {
            this.recordCallTime();
          }

          const existingMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const existingAKs = (existingMeta.answerKeys as any[]) ?? [];
          if ((extracted.answerKeys?.length ?? 0) > 0) {
            for (const newAk of extracted.answerKeys) {
              const newKeyStr = JSON.stringify(newAk.answers);
              const isDupe = existingAKs.some((ak: any) => JSON.stringify(ak.answers) === newKeyStr);
              if (!isDupe) existingAKs.push(newAk);
            }
            this.logInfo('Extraction', `Saved answer keys from ${keyPagePath}`);
          }

          const updatedProcessedKeyPages = (existingMeta.processedKeyPages as string[]) ?? [];
          if (!updatedProcessedKeyPages.includes(keyPagePath)) {
            updatedProcessedKeyPages.push(keyPagePath);
          }

          this.state.updateMetadata({ ...existingMeta, answerKeys: existingAKs, processedKeyPages: updatedProcessedKeyPages });
        } catch (error) {
          if (signal?.aborted) throw error;
          this.logError('Extraction', `Error extracting keys from ${keyPagePath}:`, error);
        }
      }
    }

    // ── Pass 2: Question Extraction ──
    const relevantImages: string[] = [];
    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification !== 'OTHER') relevantImages.push(imagePath);
    }

    if (relevantImages.length === 0) {
      this.logInfo('Extraction', 'No relevant images found for questions');
      return;
    }

    this.logInfo('Extraction', `Stage Config — Provider: ${this.extractionProvider!.constructor.name}, Model: ${this.extractionProvider!.model}, Temperature: ${temperature ?? 'default'}, Batch Size: ${batchSize}, Delay: ${this.callDelayMs.extraction}ms`);

    // Chunking logic based on QUESTIONS_WITH_KEYS
    const chunks: string[][] = [];
    let currentChunk: string[] = [];

    for (const img of relevantImages) {
      currentChunk.push(img);
      if (imageClassifications[img] === 'QUESTIONS_WITH_KEYS') {
        chunks.push([...currentChunk]);
        currentChunk = [img]; // The boundary page is also the start of the next chunk
      }
    }
    // Add the final chunk if it has new items
    if (currentChunk.length > 0) {
      const isJustBoundary = currentChunk.length === 1 && imageClassifications[currentChunk[0]] === 'QUESTIONS_WITH_KEYS';
      // If it's the very first chunk, we push it regardless. If it's just a boundary carried over, we don't.
      if (chunks.length === 0 || !isJustBoundary) {
        chunks.push(currentChunk);
      }
    }

    // Generate batches for all chunks
    const groups: { images: string[]; spatialInstructions: string[]; answerKeyRef?: number; hasUnderneathKeys: boolean }[] = [];
    const overlap = 1;
    const stride = Math.max(1, batchSize - overlap);

    for (const chunk of chunks) {
      // Find the answer key page for this chunk
      const keyImg = chunk
        .slice()
        .reverse()
        .find((img) => imageClassifications[img] === 'QUESTIONS_WITH_KEYS');
      let answerKeyRef: number | undefined;
      if (keyImg) {
        const m = keyImg.match(/page\.(\d+)\./);
        if (m) answerKeyRef = parseInt(m[1], 10);
      }

      for (let i = 0; i < chunk.length; i += stride) {
        const group = chunk.slice(i, i + batchSize);
        if (group.length === 0) break;

        const spatialInstructions: string[] = [];
        const hasUnderneathKeys = group.some((img) => imageClassifications[img] === 'QUESTIONS_WITH_KEY_UNDERNEATH');

        if (hasUnderneathKeys) {
          spatialInstructions.push("The answer key is provided right below each question. Extract the correct answer and set 'isCorrect: true' for that choice.");
        }

        const firstImg = group[0];
        const lastImg = group[group.length - 1];

        if (imageClassifications[firstImg] === 'QUESTIONS_WITH_KEYS') {
          spatialInstructions.push('CRITICAL: For the first image, ignore the answer key table and anything above it. Begin extracting questions ONLY from the text that appears *below* the answer keys.');
        }

        if (group.length > 1 && imageClassifications[lastImg] === 'QUESTIONS_WITH_KEYS') {
          spatialInstructions.push('CRITICAL: For the final image, STOP extracting immediately when you reach the answer key table. Do not extract anything below the answer keys.');
        }

        groups.push({ images: group, spatialInstructions, answerKeyRef, hasUnderneathKeys });

        // Stop if we reached the end of the chunk
        if (group.length < batchSize || i + stride >= chunk.length) break;
      }
    }

    const startIndex = this.state.getLastProcessedExtractionBatchIndex() + 1;

    if (startIndex > 0 && startIndex < groups.length) {
      this.logInfo('Extraction', `Resuming from batch ${startIndex + 1} of ${groups.length}`);
    }

    for (let i = startIndex; i < groups.length; i++) {
      await onProgress?.('EXTRACTION', i + 1, groups.length);
      const { images: group, spatialInstructions, answerKeyRef, hasUnderneathKeys } = groups[i];
      try {
        const imagesB64 = group.map((img) => this.imageToBase64(img));
        const imageIndices = group.map((p) => this.imagePaths.indexOf(p) + 1).join(', ');

        await this.delayIfNeeded('extraction');
        this.logInfo('Extraction', `Extracting questions from image(s) ${imageIndices}, batch ${i + 1} of ${groups.length}...`);

        const pageNumbers = group
          .map((img) => {
            const m = img.match(/page\.(\d+)\./);
            return m ? parseInt(m[1], 10) : null;
          })
          .filter((n): n is number => n !== null);

        const extractionPrompt = buildExtractionPrompt(spatialInstructions, this.extractionSpecialInstruction, pageNumbers);

        let extracted;
        try {
          // Pass the (possibly enriched) prompt through via the extraction provider
          extracted = await this.extractionProvider!.extractFromImages(imagesB64, extractionPrompt, { temperature, signal, logger: this.config.logger, loggingPhase: 'EXTRACTION' });
        } finally {
          this.recordCallTime();
        }

        for (const eq of extracted.questions || []) {
          // Build a globally unique ID using the page number and the original question number.
          // This ensures the ID directly matches the answer-key numbering (e.g., p7_29 for Q29).
          const qNum = eq.originalQuestionNumber ?? eq.id.replace(/^p\d+_/, '');
          const pagePrefix = eq.pageNumber ? `p${eq.pageNumber}_` : '';
          const uniqueId = `${pagePrefix}${qNum}`;

          const hasDirectAnswer = eq.choices.some((c) => c.isCorrect);
          const initialStatus = hasUnderneathKeys && hasDirectAnswer ? 'READY_FOR_ENHANCEMENT' : 'AWAITING_KEY';

          const question: Question = {
            id: uniqueId,
            text: eq.text?.trim() ? eq.text : '[Question text missing in extraction]',
            status: initialStatus,
            metadata: {
              choices: eq.choices,
              pageNumber: eq.pageNumber,
              answerKeyRef: answerKeyRef ?? eq.answerKeyRef,
              originalQuestionNumber: eq.originalQuestionNumber,
            },
          };
          this.state.upsertQuestion(question);
        }

        if ((extracted.answerKeys?.length ?? 0) > 0) {
          const existingMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const existingAKs = (existingMeta.answerKeys as any[]) ?? [];
          for (const newAk of extracted.answerKeys) {
            // Deduplicate: skip if an AK with the same answers already exists
            const newKey = JSON.stringify(newAk.answers);
            const isDupe = existingAKs.some((ak: any) => JSON.stringify(ak.answers) === newKey);
            if (!isDupe) existingAKs.push(newAk);
          }
          this.state.updateMetadata({ ...existingMeta, answerKeys: existingAKs });
        }

        this.reconcileAnswerKeys();

        // Mark this batch as completed
        this.state.setLastProcessedExtractionBatchIndex(i);
        this.logInfo('Extraction', `Completed batch ${i + 1} of ${groups.length}`);
      } catch (error) {
        if (signal?.aborted) throw error;
        this.logError('Extraction', `Error processing batch starting at image ${group[0]}:`, error);
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'extraction',
          batchIndex: i,
          images: group,
        });
      }
    }

    // Always reconcile one final time at the end of the phase to catch any previously skipped questions
    // or manual logic updates.
    this.reconcileAnswerKeys();
  }

  private reconcileAnswerKeys(): void {
    const stateData = this.state.initOrLoad();
    const answerKeys = ((stateData.metadata?.answerKeys as any[]) ?? []) as Array<{
      answers: Record<string, string>;
    }>;

    for (let qIdx = 0; qIdx < stateData.questions.length; qIdx++) {
      const q = stateData.questions[qIdx];
      if (q.status !== 'AWAITING_KEY') continue;

      let currentAnswer = q.answer;
      let foundInKey = false;

      // Sort answer keys by proximity to the question's page number.
      // Answer keys always appear AFTER their questions in a PDF, so we strongly
      // prefer answer keys on a page >= the question's page. Among those, pick
      // the closest one. This ensures that when multiple sets share overlapping
      // question numbers (e.g., two sets both numbered 1–50), each question
      // matches the answer key from its own set.
      const qPage = (q.metadata?.pageNumber as number) ?? 0;
      const sortedAKs = [...answerKeys].sort((a, b) => {
        const aPage = (a as any).pageNumber ?? 0;
        const bPage = (b as any).pageNumber ?? 0;
        const aAfter = aPage >= qPage ? 0 : 1; // 0 = on or after question page
        const bAfter = bPage >= qPage ? 0 : 1;
        if (aAfter !== bAfter) return aAfter - bAfter; // prefer keys after question
        // Both on same side — pick the closest one
        return Math.abs(aPage - qPage) - Math.abs(bPage - qPage);
      });

      // Strategy 0: Exact set binding via explicit answerKeyRef
      if (q.metadata?.answerKeyRef !== undefined) {
        const taggedAK = answerKeys.find((ak) => (ak as any).pageNumber === q.metadata?.answerKeyRef);
        if (taggedAK) {
          if (taggedAK.answers[q.id]) {
            currentAnswer = taggedAK.answers[q.id];
            foundInKey = true;
          } else if (q.metadata.originalQuestionNumber && taggedAK.answers[String(q.metadata.originalQuestionNumber)]) {
            currentAnswer = taggedAK.answers[String(q.metadata.originalQuestionNumber)];
            foundInKey = true;
          } else {
            // Strategy C: Extract question number from ID (fallback)
            const idMatch = q.id.match(/_(\d+)/);
            if (idMatch && idMatch[1] && taggedAK.answers[idMatch[1]]) {
              currentAnswer = taggedAK.answers[idMatch[1]];
              foundInKey = true;
            }
          }
        }
      }

      if (!foundInKey) {
        for (const ak of sortedAKs) {
          // Strategy A: exact ID match (e.g. key is "p5_1")
          if (ak.answers[q.id]) {
            currentAnswer = ak.answers[q.id];
            foundInKey = true;
            break;
          }

          // Strategy B: Extracted original question number, scoped by page proximity
          if (q.metadata?.originalQuestionNumber && ak.answers[String(q.metadata.originalQuestionNumber)]) {
            currentAnswer = ak.answers[String(q.metadata.originalQuestionNumber)];
            foundInKey = true;
            break;
          }

          // Strategy C: Extract question number from ID (fallback)
          const idMatch = q.id.match(/_(\d+)/);
          if (idMatch && idMatch[1] && ak.answers[idMatch[1]]) {
            currentAnswer = ak.answers[idMatch[1]];
            foundInKey = true;
            break;
          }
        }
      }

      // No further fallback strategies — if originalQuestionNumber didn't match,
      // the question stays AWAITING_KEY. This is safer than guessing.

      // Normalize answer and isCorrect flags
      const choices = (q.metadata?.choices as any[]) ?? [];
      const trueOptions = choices.map((opt: any, index: number) => ({ opt, index })).filter((item: any) => item.opt.isCorrect === true);
      const hasAnswerKey = currentAnswer !== undefined && currentAnswer !== null;

      if (hasAnswerKey && trueOptions.length === 0) {
        // Case 1: answer key present, all isCorrect false
        const answerChar = currentAnswer!.charAt(0).toUpperCase();
        const targetIndex = answerChar.charCodeAt(0) - 65; // A=0, B=1, etc.
        if (targetIndex >= 0 && targetIndex < choices.length) {
          choices.forEach((opt: any, idx: number) => {
            opt.isCorrect = idx === targetIndex;
          });
        } else {
          console.warn(`[Reconciliation] Question ${q.id} has answer key ${currentAnswer} but extracted only ${choices.length} choices.`);
        }
      } else if (!hasAnswerKey && trueOptions.length > 0) {
        // Case 2: No answer key matched, but AI set isCorrect on some choice(s).
        // This can happen in two scenarios:
        //   A) The answer was genuinely printed inline (e.g. "Answer: 3" below the question)
        //   B) The AI hallucinated the answer to satisfy the schema
        //
        // We trust the extraction AI here — the prompt rules (§7) only allow
        // isCorrect: true when the answer is explicitly visible in the source image.
        // Derive the answer letter from the first isCorrect choice.
        const answerIndex = trueOptions[0].index;
        const answerLetter = String.fromCharCode(65 + answerIndex).toLowerCase(); // 0→a, 1→b, etc.
        currentAnswer = answerLetter;
        foundInKey = false; // not from a key table, but the answer is resolved
      } else if (hasAnswerKey && trueOptions.length > 0) {
        // Case 3: Both exist, check for mismatch
        const answerChar = currentAnswer!.charAt(0).toUpperCase();
        const expectedIndex = answerChar.charCodeAt(0) - 65;
        const actualIndex = trueOptions[0].index;

        if (expectedIndex !== actualIndex && expectedIndex >= 0 && expectedIndex < choices.length) {
          // Mismatch! Prioritize explicit answer key
          choices.forEach((opt: any, idx: number) => {
            opt.isCorrect = idx === expectedIndex;
          });
        } else if (expectedIndex >= choices.length) {
          console.warn(`[Reconciliation] Question ${q.id} has answer key ${currentAnswer} but extracted only ${choices.length} choices.`);
        }
      }

      const updatedQ = {
        ...q,
        answer: currentAnswer,
        metadata: {
          ...q.metadata,
          choices,
        },
      };

      const hasDirectAnswer = choices.some((c: any) => c.isCorrect === true);

      if (foundInKey || hasDirectAnswer) {
        this.state.upsertQuestion({ ...updatedQ, status: 'READY_FOR_ENHANCEMENT' });
      } else {
        // Just save the normalized state without changing status
        this.state.upsertQuestion(updatedQ);
      }
    }
  }

  // ── Phase 3: Enhancement ──────────────────────────────────────────────────

  private async runEnhancementPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');
    const temperature = this.config.temperatures?.enhancement;
    const concurrency = this.config.enhancementConcurrency ?? 10;

    this.logInfo('Enhancement', `Stage Config — Provider: ${this.enhancementProvider!.constructor.name}, Model: ${this.enhancementProvider!.model}, Temperature: ${temperature ?? 'default'}, Delay: ${this.callDelayMs.enhancement}ms`);

    this.logInfo('Enhancement', `Enhancing ${questionsToEnhance.length} questions`);

    // Build the prompt once — optionally prefixed with the book's special instruction, injecting available categories
    const enhancementPrompt = buildEnhancementPrompt(this.availableCategories, this.enhancementSpecialInstruction);

    for (let i = 0; i < questionsToEnhance.length; i += concurrency) {
      await onProgress?.('ENHANCEMENT', Math.min(i + concurrency, questionsToEnhance.length), questionsToEnhance.length);
      const chunk = questionsToEnhance.slice(i, i + concurrency);

      const processedChunk = await Promise.all(
        chunk.map(async (question, chunkIdx) => {
          const idx = i + chunkIdx;
          try {
            // delayIfNeeded is intentionally omitted here: Promise.all runs calls
            // concurrently, so a shared lastCallTime would be read/written by all
            // parallel invocations simultaneously — making the delay unreliable.
            // Rate limiting is handled correctly at the provider level via
            // GenericAIProvider.enforceRateLimit(minCallIntervalMs).
            this.logInfo('Enhancement', `Enhancing question ${question.id} [${idx + 1}/${questionsToEnhance.length}]...`);
            let enhanced;
            try {
              enhanced = await this.enhancementProvider!.enhanceQuestion(question.text, (question.metadata?.choices as unknown[]) ?? [], enhancementPrompt, { temperature, signal, logger: this.config.logger, loggingPhase: 'ENHANCEMENT' });
            } finally {
              this.recordCallTime();
            }

            this.logInfo('Enhancement', `Enhanced ${question.id} — difficulty: ${enhanced.difficulty}`);

            return {
              ...question,
              status: 'READY_FOR_UPLOAD' as const,
              metadata: {
                ...question.metadata,
                hint: enhanced.hint,
                explanation: enhanced.explanation,
                aiQualityScore: enhanced.aiQualityScore,
                topic: enhanced.topic,
                categorySlugs: enhanced.categorySlugs,
                // Store the AI-inferred difficulty; sanitised before upload
                difficulty: sanitiseDifficulty(enhanced.difficulty),
                // Store the AI-inferred age rating; sanitised before upload
                ageRating: sanitiseAgeRating(enhanced.ageRating),
                isFactuallyCorrect: enhanced.isFactuallyCorrect,
                factCheckRationale: enhanced.factCheckRationale,
                // Flag questions that are only meaningful in the context of the source document
                isSelfReferential: enhanced.isSelfReferential,
              },
            };
          } catch (error) {
            if (signal?.aborted) throw error;
            this.logError('Enhancement', `Error processing question ${question.id}:`, error);
            reportError(error instanceof Error ? error : new Error(String(error)), {
              phase: 'enhancement',
              questionId: question.id,
            });
            return null;
          }
        }),
      );

      const successfulQuestions = processedChunk.filter((q): q is NonNullable<typeof q> => q !== null);
      if (successfulQuestions.length > 0) {
        this.state.upsertQuestions(successfulQuestions);
      }
    }
  }

  // ── Phase 4: Upload ───────────────────────────────────────────────────────

  private async uploadPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const readyQuestions = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD');

    this.logInfo('Upload', `Uploading ${readyQuestions.length} questions`);
    if (readyQuestions.length === 0) return;

    for (let i = 0; i < readyQuestions.length; i++) {
      await onProgress?.('UPLOAD', i + 1, readyQuestions.length);
      const q = readyQuestions[i];
      try {
        // ── Self-referential guard ────────────────────────────────────────────
        // Questions flagged as self-referential are about the source document
        // itself (e.g. publisher, glossary count) and have no standalone trivia
        // value. Mark as uploaded so they are never retried, but skip DB write.
        if (q.metadata?.isSelfReferential === true) {
          this.logInfo('Upload', `Skipping self-referential question ${q.id} — not meaningful outside source document`);
          this.state.updateStatus(q.id, 'UPLOADED');
          continue;
        }

        const newScore: number = (q.metadata?.aiQualityScore as number) ?? 0;

        // ── Step 1: Check PendingQuestion table for a near-duplicate ──────────
        const pendingCheck = await checkPendingDuplicate(q.text);

        if (pendingCheck.found && pendingCheck.record) {
          const existing = pendingCheck.record;
          const existingScore: number = existing.aiQualityScore ?? 0;

          // Handle any existing status ('PENDING', 'AI-APPROVED', 'AI-REJECTED', 'APPROVED', 'REJECTED', 'PENDING-DUPLICATE')
          if (newScore > existingScore) {
            this.logInfo('Upload', `Replacing ${existing.status} record ${existing.id} (score ${existingScore}) with higher-scored version (score ${newScore})`);

            await prisma.pendingQuestion.update({
              where: { id: existing.id },
              data: {
                status: 'PENDING', // Reset status so it can be re-evaluated
                topic: (q.metadata?.topic as string) || this.config.topic || 'General',
                categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
                difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
                suggestedText: q.text,
                suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
                hint: (q.metadata?.hint as string) ?? null,
                explanation: (q.metadata?.explanation as string) ?? null,
                aiQualityScore: newScore,
                aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
                ageRating: sanitiseAgeRating(q.metadata?.ageRating as string | undefined),
              },
            });
          } else {
            this.logInfo('Upload', `Skipping — existing ${existing.status} record ${existing.id} has equal or higher score (${existingScore} >= ${newScore})`);
          }

          this.state.updateStatus(q.id, 'UPLOADED');
          continue;
        }

        // ── Step 2: No active pending match — check the live Question table ───
        const isLiveDuplicate = await checkIsDuplicate(q.text);

        if (isLiveDuplicate) {
          // Find the live Question id for the closest match so we can link the PENDING-DUPLICATE row
          const liveRows = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id
            FROM "Question"
            WHERE similarity("questionText", ${q.text}) > 0.85
            ORDER BY similarity("questionText", ${q.text}) DESC
            LIMIT 1
          `;
          const liveQuestionId = liveRows[0]?.id ?? null;

          // Case B — Insert a PENDING-DUPLICATE row pointing to the live question
          this.logInfo('Upload', `Inserting PENDING-DUPLICATE for live question ${liveQuestionId ?? 'unknown'} (new score: ${newScore})`);

          await prisma.pendingQuestion.create({
            data: {
              topic: (q.metadata?.topic as string) || this.config.topic || 'General',
              categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
              difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
              suggestedText: q.text,
              suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
              hint: (q.metadata?.hint as string) ?? null,
              explanation: (q.metadata?.explanation as string) ?? null,
              status: 'PENDING-DUPLICATE',
              isDuplicate: true,
              aiQualityScore: newScore,
              aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
              ageRating: sanitiseAgeRating(q.metadata?.ageRating as string | undefined),
              replacesQuestionId: liveQuestionId,
            } as any,
          });
        } else {
          // ── Step 3: Genuinely new question — insert normally ─────────────────
          await prisma.pendingQuestion.create({
            data: {
              topic: (q.metadata?.topic as string) || this.config.topic || 'General',
              categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
              difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
              suggestedText: q.text,
              suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
              hint: (q.metadata?.hint as string) ?? null,
              explanation: (q.metadata?.explanation as string) ?? null,
              status: 'PENDING',
              isDuplicate: false,
              aiQualityScore: newScore,
              aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
              ageRating: sanitiseAgeRating(q.metadata?.ageRating as string | undefined),
            } as any,
          });

          this.logInfo('Upload', `Inserted new PENDING question (score: ${newScore})`);
        }

        this.state.updateStatus(q.id, 'UPLOADED');
      } catch (error) {
        this.logError('Upload', `Error uploading question ${q.id}:`, error);
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'upload',
          questionId: q.id,
        });
      }
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private imageToBase64(imagePath: string): { base64: string; mimeType: string } {
    const buffer = fs.readFileSync(imagePath);
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeType = `image/${ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png'}`;
    return { base64: buffer.toString('base64'), mimeType };
  }
}
