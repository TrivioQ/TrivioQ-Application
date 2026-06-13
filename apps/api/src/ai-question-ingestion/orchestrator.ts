import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from './utils/state-manager';
import { checkIsDuplicate } from '../utils/check-is-duplicate';
import { checkPendingDuplicate } from '../utils/check-pending-duplicate';
import { shuffleArray } from '../utils/shuffle';
import { reportError } from '../utils/error-reporter';
import fs from 'fs';
import { createProvider, type AIProvider, type AIProviderName } from './providers';
import { buildExtractionPrompt, buildEnhancementPrompt, KEY_EXTRACTION_PROMPT } from './prompts';

// ── Re-exports (kept for backwards-compatibility with existing callers) ────────
export type { ExtractedQuestion, ExtractedAnswerKey, EnhancementResult } from './providers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageType = 'QUESTIONS' | 'QUESTIONS_WITH_KEYS' | 'QUESTIONS_WITH_KEY_UNDERNEATH' | 'OTHER';

// ── Configuration ─────────────────────────────────────────────────────────────

const DEFAULT_CALL_DELAY = 10;
const VALID_DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

/** Validate an AI-returned difficulty string; falls back to MEDIUM if invalid. */
function sanitiseDifficulty(raw: string | undefined): DifficultyLevel {
  if (raw && (VALID_DIFFICULTIES as string[]).includes(raw)) {
    return raw as DifficultyLevel;
  }
  console.warn(`[Orchestrator] Invalid difficulty "${raw}" — defaulting to MEDIUM`);
  return 'MEDIUM';
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class IngestionOrchestrator {
  private readonly state: IngestionState;
  /** Provider used in Phase 1 — image classification. */
  private readonly scoutProvider: AIProvider;
  /** Provider used in Phase 2 — question extraction. */
  private readonly extractionProvider: AIProvider;
  /** Provider used in Phase 3 — question enhancement + difficulty inference. */
  private readonly enhancementProvider: AIProvider;
  private readonly extractionSpecialInstruction?: string;
  private readonly enhancementSpecialInstruction?: string;
  private readonly callDelayMs: { scout: number; extraction: number; enhancement: number };

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: {
      outputDir: string;
      topic?: string;
      /** One or more category slugs. Multiple slugs create one PendingQuestion row per slug. */
      categorySlugs?: string[];
      /**
       * Fallback AI provider for all phases.
       * Falls back to INGESTION_AI_PROVIDER env var, then 'google'.
       */
      aiProvider?: AIProviderName;
      /**
       * Per-phase provider overrides. Each key takes precedence over `aiProvider`
       * and the INGESTION_AI_PROVIDER env var.
       *
       * Per-phase env var fallback order (example for scout):
       *   providers.scout → aiProvider → INGESTION_SCOUT_PROVIDER → INGESTION_AI_PROVIDER → 'google'
       */
      providers?: {
        /** Provider for image classification (Scout phase). */
        scout?: AIProviderName;
        /** Provider for question extraction (Extraction phase). */
        extraction?: AIProviderName;
        /** Provider for question enhancement + difficulty (Enhancement phase). */
        enhancement?: AIProviderName;
      };
      models?: {
        /** Model override for image classification (Scout phase). */
        scout?: string;
        /** Model override for question extraction (Extraction phase). */
        extraction?: string;
        /** Model override for question enhancement + difficulty (Enhancement phase). */
        enhancement?: string;
      };
      /** Optional free-text instruction for the extraction phase. */
      extractionSpecialInstruction?: string;
      /** Optional free-text instruction for the enhancement phase. */
      enhancementSpecialInstruction?: string;
    },
  ) {
    this.state = new IngestionState(bookId, config.outputDir);

    // Resolve the global fallback once
    const globalDefault: AIProviderName = config.aiProvider ?? (process.env.INGESTION_AI_PROVIDER as AIProviderName | undefined) ?? 'google';

    const scoutModel = config.models?.scout ?? process.env.INGESTION_SCOUT_MODEL;
    const extractionModel = config.models?.extraction ?? process.env.INGESTION_EXTRACTION_MODEL;
    const enhancementModel = config.models?.enhancement ?? process.env.INGESTION_ENHANCEMENT_MODEL;

    this.scoutProvider = createProvider(config.providers?.scout ?? (process.env.INGESTION_SCOUT_PROVIDER as AIProviderName | undefined) ?? globalDefault, scoutModel);

    this.extractionProvider = createProvider(config.providers?.extraction ?? (process.env.INGESTION_EXTRACTION_PROVIDER as AIProviderName | undefined) ?? globalDefault, extractionModel);

    this.enhancementProvider = createProvider(config.providers?.enhancement ?? (process.env.INGESTION_ENHANCEMENT_PROVIDER as AIProviderName | undefined) ?? globalDefault, enhancementModel);

    this.extractionSpecialInstruction = config.extractionSpecialInstruction;
    this.enhancementSpecialInstruction = config.enhancementSpecialInstruction;

    this.callDelayMs = {
      scout: (process.env.INGESTION_SCOUT_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_SCOUT_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
      extraction: (process.env.INGESTION_EXTRACTION_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_EXTRACTION_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
      enhancement: (process.env.INGESTION_ENHANCEMENT_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_ENHANCEMENT_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
    };
  }

  private availableCategories: { slug: string; name: string }[] = [];
  private lastCallTime = 0;

  private async delayIfNeeded(phase: 'scout' | 'extraction' | 'enhancement'): Promise<void> {
    if (this.lastCallTime > 0) {
      const elapsed = Date.now() - this.lastCallTime;
      const delay = this.callDelayMs[phase] - elapsed;
      if (delay > 0) {
        console.log(`[Orchestrator] Delaying ${Math.ceil(delay / 1000)} seconds to rate-limit AI calls...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private recordCallTime(): void {
    this.lastCallTime = Date.now();
  }

  async run(options?: { reuploadOnly?: boolean }): Promise<void> {
    this.state.initOrLoad();
    console.log(`[Orchestrator] Starting ingestion for ${this.imagePaths.length} images`);
    console.log(`[Orchestrator] Categories: ${(this.config.categorySlugs ?? []).join(', ')}`);
    console.log(`[Orchestrator] Providers — scout: ${this.scoutProvider.constructor.name}, extraction: ${this.extractionProvider.constructor.name}, enhancement: ${this.enhancementProvider.constructor.name}`);
    if (this.extractionSpecialInstruction || this.enhancementSpecialInstruction) {
      const ei = this.extractionSpecialInstruction?.slice(0, 80);
      const hi = this.enhancementSpecialInstruction?.slice(0, 80);
      console.log(`[Orchestrator] Special instructions — extraction: ${ei ?? 'none'}, enhancement: ${hi ?? 'none'}`);
    }

    this.availableCategories = await prisma.category.findMany({
      select: { slug: true, name: true },
    });
    console.log(`[Orchestrator] Fetched ${this.availableCategories.length} categories from DB`);

    if (options?.reuploadOnly) {
      console.log('[Orchestrator] Reupload mode: preparing questions for upload...');
      const stateData = this.state.initOrLoad();
      for (const q of stateData.questions) {
        if (q.status === 'UPLOADED' || q.status === 'READY_FOR_UPLOAD') {
          this.state.updateStatus(q.id, 'READY_FOR_UPLOAD');
        }
      }
      await this.uploadPhase();
    } else {
      await this.scoutPhase();
      await this.extractionPhase();
      await this.enhancementPhase();
      await this.uploadPhase();
    }

    console.log('[Orchestrator] Ingestion complete');
  }

  // ── Phase 1: Scout ────────────────────────────────────────────────────────

  private async scoutPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const startIndex = stateData.lastProcessedImageIndex + 1;

    console.log(`[Scout] Starting from image ${startIndex + 1}`);
    const tempStr = process.env.INGESTION_SCOUT_TEMPERATURE;
    console.log(`[Scout] Stage Config — Provider: ${this.scoutProvider.constructor.name}, Model: ${this.scoutProvider.model}, Temperature: ${tempStr ?? 'default'}, Delay: ${this.callDelayMs.scout}ms`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      const imagePath = this.imagePaths[i];

      try {
        const image = this.imageToBase64(imagePath);
        const stateData = this.state.initOrLoad();
        const existingMeta = (stateData.metadata as Record<string, unknown>) ?? {};
        const imageClassifications = (existingMeta.imageClassifications as Record<string, ImageType>) ?? {};

        await this.delayIfNeeded('scout');
        console.log(`[Scout] Classifying image ${i + 1}...`);
        let classification: ImageType;
        try {
          const res = await this.scoutProvider.classifyImage(image);
          classification = res.classification;
        } finally {
          this.recordCallTime();
        }
        imageClassifications[imagePath] = classification;

        this.state.updateMetadata({ ...existingMeta, imageClassifications });
        this.state.setLastProcessedImageIndex(i);

        console.log(`[Scout] Image ${i + 1} classified as ${classification}`);
      } catch (error) {
        console.error(`[Scout] Error processing image ${imagePath}:`, error);
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

  private async extractionPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const imageClassifications = (stateData.metadata?.imageClassifications as Record<string, ImageType>) ?? {};

    // ── Pass 1: Extract Keys from 'QUESTIONS_WITH_KEYS' pages ──
    const keyPages: string[] = [];
    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification === 'QUESTIONS_WITH_KEYS') keyPages.push(imagePath);
    }

    if (keyPages.length > 0) {
      console.log(`[Extraction] Pass 1: Extracting answer keys from ${keyPages.length} boundary pages...`);
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
            console.log(`[Extraction] Skipping already extracted key page ${keyPagePath}`);
            continue;
          }

          const image = this.imageToBase64(keyPagePath);
          await this.delayIfNeeded('extraction');

          console.log(`[Extraction] Extracting keys from ${keyPagePath}...`);
          let extracted;
          try {
            extracted = await this.extractionProvider.extractFromImages([image], KEY_EXTRACTION_PROMPT);
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
            console.log(`[Extraction] Saved answer keys from ${keyPagePath}`);
          }

          const updatedProcessedKeyPages = (existingMeta.processedKeyPages as string[]) ?? [];
          if (!updatedProcessedKeyPages.includes(keyPagePath)) {
            updatedProcessedKeyPages.push(keyPagePath);
          }

          this.state.updateMetadata({ ...existingMeta, answerKeys: existingAKs, processedKeyPages: updatedProcessedKeyPages });
        } catch (error) {
          console.error(`[Extraction] Error extracting keys from ${keyPagePath}:`, error);
        }
      }
    }

    // ── Pass 2: Question Extraction ──
    const relevantImages: string[] = [];
    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification !== 'OTHER') relevantImages.push(imagePath);
    }

    if (relevantImages.length === 0) {
      console.log('[Extraction] No relevant images found for questions');
      return;
    }

    const tempStr = process.env.INGESTION_EXTRACTION_TEMPERATURE;
    const batchSize = process.env.INGESTION_EXTRACTION_BATCH_SIZE ? parseInt(process.env.INGESTION_EXTRACTION_BATCH_SIZE, 10) : 1;
    console.log(`[Extraction] Stage Config — Provider: ${this.extractionProvider.constructor.name}, Model: ${this.extractionProvider.model}, Temperature: ${tempStr ?? 'default'}, Batch Size: ${batchSize}, Delay: ${this.callDelayMs.extraction}ms`);

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

    if (startIndex > 0 && startIndex <= groups.length) {
      console.log(`[Extraction] Resuming from batch ${startIndex + 1} of ${groups.length}`);
    }

    for (let i = startIndex; i < groups.length; i++) {
      const { images: group, spatialInstructions, answerKeyRef, hasUnderneathKeys } = groups[i];
      try {
        const imagesB64 = group.map((img) => this.imageToBase64(img));
        const imageIndices = group.map((p) => this.imagePaths.indexOf(p) + 1).join(', ');

        await this.delayIfNeeded('extraction');
        console.log(`[Extraction] Extracting questions from image(s) ${imageIndices}...`);

        const extractionPrompt = buildExtractionPrompt(spatialInstructions, this.extractionSpecialInstruction);

        let extracted;
        try {
          // Pass the (possibly enriched) prompt through via the extraction provider
          extracted = await this.extractionProvider.extractFromImages(imagesB64, extractionPrompt);
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
            text: eq.text,
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
        console.log(`[Extraction] Completed batch ${i + 1} of ${groups.length}`);
      } catch (error) {
        console.error(`[Extraction] Error processing batch ${i + 1}:`, error);
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

  private async enhancementPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');

    const tempStr = process.env.INGESTION_ENHANCEMENT_TEMPERATURE;
    console.log(`[Enhancement] Stage Config — Provider: ${this.enhancementProvider.constructor.name}, Model: ${this.enhancementProvider.model}, Temperature: ${tempStr ?? 'default'}, Delay: ${this.callDelayMs.enhancement}ms`);

    console.log(`[Enhancement] Enhancing ${questionsToEnhance.length} questions`);

    // Build the prompt once — optionally prefixed with the book's special instruction, injecting available categories
    const enhancementPrompt = buildEnhancementPrompt(this.availableCategories, this.enhancementSpecialInstruction);

    for (const question of questionsToEnhance) {
      try {
        await this.delayIfNeeded('enhancement');
        console.log(`[Enhancement] Enhancing question ${question.id}...`);
        let enhanced;
        try {
          enhanced = await this.enhancementProvider.enhanceQuestion(question.text, (question.metadata?.choices as unknown[]) ?? [], enhancementPrompt);
        } finally {
          this.recordCallTime();
        }

        this.state.upsertQuestion({
          ...question,
          status: 'READY_FOR_UPLOAD',
          metadata: {
            ...question.metadata,
            hint: enhanced.hint,
            explanation: enhanced.explanation,
            aiQualityScore: enhanced.aiQualityScore,
            topic: enhanced.topic,
            categorySlugs: enhanced.categorySlugs,
            // Store the AI-inferred difficulty; sanitised before upload
            difficulty: sanitiseDifficulty(enhanced.difficulty),
            isFactuallyCorrect: enhanced.isFactuallyCorrect,
            factCheckRationale: enhanced.factCheckRationale,
          },
        });

        console.log(`[Enhancement] Enhanced ${question.id} — difficulty: ${enhanced.difficulty}`);
      } catch (error) {
        console.error(`[Enhancement] Error processing question ${question.id}:`, error);
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'enhancement',
          questionId: question.id,
        });
      }
    }
  }

  // ── Phase 4: Upload ───────────────────────────────────────────────────────

  private async uploadPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const readyQuestions = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD');

    console.log(`[Upload] Uploading ${readyQuestions.length} questions`);
    if (readyQuestions.length === 0) return;

    for (const q of readyQuestions) {
      try {
        const newScore: number = (q.metadata?.aiQualityScore as number) ?? 0;

        // ── Step 1: Check PendingQuestion table for a near-duplicate ──────────
        const pendingCheck = await checkPendingDuplicate(q.text);

        if (pendingCheck.found && pendingCheck.record) {
          const existing = pendingCheck.record;
          const existingScore: number = existing.aiQualityScore ?? 0;

          if (existing.status === 'PENDING') {
            if (newScore > existingScore) {
              // Case A — Replace the lower-scored pending record in-place
              console.log(`[Upload] Replacing PENDING record ${existing.id} (score ${existingScore}) with higher-scored version (score ${newScore})`);

              await prisma.pendingQuestion.update({
                where: { id: existing.id },
                data: {
                  topic: (q.metadata?.topic as string) || this.config.topic || 'General',
                  categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
                  difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
                  suggestedText: q.text,
                  suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
                  hint: (q.metadata?.hint as string) ?? null,
                  explanation: (q.metadata?.explanation as string) ?? null,
                  aiQualityScore: newScore,
                  aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
                },
              });
            } else {
              console.log(`[Upload] Skipping — existing PENDING record ${existing.id} has equal or higher score (${existingScore} >= ${newScore})`);
            }

            this.state.updateStatus(q.id, 'UPLOADED');
            continue;
          }

          if (existing.status === 'PENDING-DUPLICATE') {
            // There is already a PENDING-DUPLICATE row; compare scores and replace if better
            if (newScore > existingScore) {
              console.log(`[Upload] Replacing existing PENDING-DUPLICATE record ${existing.id} (score ${existingScore}) with higher score (${newScore})`);
              await prisma.pendingQuestion.update({
                where: { id: existing.id },
                data: {
                  topic: (q.metadata?.topic as string) || this.config.topic || 'General',
                  categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
                  difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
                  suggestedText: q.text,
                  suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
                  hint: (q.metadata?.hint as string) ?? null,
                  explanation: (q.metadata?.explanation as string) ?? null,
                  aiQualityScore: newScore,
                  aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
                },
              });
            } else {
              console.log(`[Upload] Skipping — existing PENDING-DUPLICATE record ${existing.id} has equal or higher score (${existingScore} >= ${newScore})`);
            }

            this.state.updateStatus(q.id, 'UPLOADED');
            continue;
          }
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
          console.log(`[Upload] Inserting PENDING-DUPLICATE for live question ${liveQuestionId ?? 'unknown'} (new score: ${newScore})`);

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
              isValidated: false,
              aiQualityScore: newScore,
              aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
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
              isValidated: false,
              aiQualityScore: newScore,
              aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
            } as any,
          });

          console.log(`[Upload] Inserted new PENDING question (score: ${newScore})`);
        }

        this.state.updateStatus(q.id, 'UPLOADED');
      } catch (error) {
        console.error(`[Upload] Error uploading question ${q.id}:`, error);
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
