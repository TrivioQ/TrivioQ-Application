import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from './utils/stateManager';
import { checkIsDuplicate } from '../utils/checkIsDuplicate';
import { checkPendingDuplicate } from '../utils/checkPendingDuplicate';
import { shuffleArray } from '../utils/shuffle';
import { reportError } from '../utils/errorReporter';
import fs from 'fs';
import { createProvider, type AIProvider, type AIProviderName } from './providers';
import { buildExtractionPrompt, buildEnhancementPrompt } from './prompts';

// ── Re-exports (kept for backwards-compatibility with existing callers) ────────
export type { ExtractedQuestion, ExtractedAnswerKey, EnhancementResult } from './providers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageType = 'RELEVANT' | 'OTHER';

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

    const relevantImages: string[] = [];

    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification === 'RELEVANT') relevantImages.push(imagePath);
    }

    if (relevantImages.length === 0) {
      console.log('[Extraction] No RELEVANT images found');
      return;
    }

    const tempStr = process.env.INGESTION_EXTRACTION_TEMPERATURE;
    const batchSize = process.env.INGESTION_EXTRACTION_BATCH_SIZE ? parseInt(process.env.INGESTION_EXTRACTION_BATCH_SIZE, 10) : 1;
    console.log(`[Extraction] Stage Config — Provider: ${this.extractionProvider.constructor.name}, Model: ${this.extractionProvider.model}, Temperature: ${tempStr ?? 'default'}, Batch Size: ${batchSize}, Delay: ${this.callDelayMs.extraction}ms`);

    console.log(`[Extraction] Processing ${relevantImages.length} relevant images`);

    // Build the prompt once — optionally prefixed with the book's special instruction
    const extractionPrompt = buildExtractionPrompt(this.extractionSpecialInstruction);

    // Chunk images into overlapping batches (stride = batchSize - 1, min stride = 1)
    const overlap = 1;
    const stride = Math.max(1, batchSize - overlap);
    const groups: string[][] = [];
    for (let i = 0; i < relevantImages.length; i += stride) {
      const group = relevantImages.slice(i, i + batchSize);
      groups.push(group);
      if (group.length < batchSize) break;
    }

    const startIndex = this.state.getLastProcessedExtractionBatchIndex() + 1;

    if (startIndex > 0 && startIndex <= groups.length) {
      console.log(`[Extraction] Resuming from batch ${startIndex + 1} of ${groups.length}`);
    }

    for (let i = startIndex; i < groups.length; i++) {
      const group = groups[i];
      try {
        const images = group.map((img) => this.imageToBase64(img));

        const imageIndices = group.map((p) => this.imagePaths.indexOf(p) + 1).join(', ');
        await this.delayIfNeeded('extraction');
        console.log(`[Extraction] Extracting questions from image(s) ${imageIndices}...`);
        let extracted;
        try {
          // Pass the (possibly enriched) prompt through via the extraction provider
          extracted = await this.extractionProvider.extractFromImages(images, extractionPrompt);
        } finally {
          this.recordCallTime();
        }

        for (const eq of extracted.questions || []) {
          // Guarantee a globally unique ID by prepending the page number
          const uniqueId = eq.pageNumber && !eq.id.includes(`p${eq.pageNumber}`) ? `p${eq.pageNumber}_${eq.id}` : eq.id;

          const question: Question = {
            id: uniqueId,
            text: eq.text,
            status: 'AWAITING_KEY',
            metadata: {
              choices: eq.choices,
              pageNumber: eq.pageNumber,
              answerKeyRef: eq.answerKeyRef,
            },
          };
          this.state.upsertQuestion(question);
        }

        if ((extracted.answerKeys?.length ?? 0) > 0) {
          const existingMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const existingAKs = (existingMeta.answerKeys as any[]) ?? [];
          existingAKs.push(...extracted.answerKeys);
          this.state.updateMetadata({ ...existingMeta, answerKeys: existingAKs });
        }

        this.reconcileAnswerKeys();

        // Mark this batch as completed
        this.state.setLastProcessedExtractionBatchIndex(i);
        console.log(`[Extraction] Completed batch ${i + 1} of ${groups.length}`);
      } catch (error) {
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

    for (const q of stateData.questions) {
      if (q.status !== 'AWAITING_KEY') continue;

      let currentAnswer = q.answer;
      let foundInKey = false;
      for (const ak of answerKeys) {
        // Try exact match, then stripped prefix match, then added prefix match
        const originalIdMatch = q.id.match(/_([^_]+)$/);
        const baseId = originalIdMatch ? originalIdMatch[1] : q.id;
        const rawId = baseId.replace(/^q/i, '');
        const qIdVariant = `q${rawId}`;

        if (ak.answers[q.id]) {
          currentAnswer = ak.answers[q.id];
          foundInKey = true;
          break;
        } else if (ak.answers[baseId]) {
          currentAnswer = ak.answers[baseId];
          foundInKey = true;
          break;
        } else if (ak.answers[rawId]) {
          currentAnswer = ak.answers[rawId];
          foundInKey = true;
          break;
        } else if (ak.answers[qIdVariant]) {
          currentAnswer = ak.answers[qIdVariant];
          foundInKey = true;
          break;
        }
      }

      // Normalize answer and isCorrect flags
      const choices = (q.metadata?.choices as any[]) ?? [];
      const trueOptions = choices.map((opt: any, index: number) => ({ opt, index })).filter((item: any) => item.opt.isCorrect === true);
      const hasAnswerKey = currentAnswer !== undefined && currentAnswer !== null;

      if (hasAnswerKey && trueOptions.length === 0) {
        // Case 1: answer key present, all isCorrect false
        const answerChar = currentAnswer!.charAt(0).toUpperCase();
        const targetIndex = answerChar.charCodeAt(0) - 65; // A=0, B=1, etc.
        choices.forEach((opt: any, idx: number) => {
          opt.isCorrect = idx === targetIndex;
        });
      } else if (!hasAnswerKey && trueOptions.length > 0) {
        // Case 2: answer key missing, some isCorrect true
        // The LLM often hallucinates the correct answer to satisfy the JSON schema.
        // If we don't have an explicit answer key matched, we must clear these hallucinations
        // so the question remains in AWAITING_KEY status.
        choices.forEach((opt: any) => {
          opt.isCorrect = false;
        });
      } else if (hasAnswerKey && trueOptions.length > 0) {
        // Case 3: Both exist, check for mismatch
        const answerChar = currentAnswer!.charAt(0).toUpperCase();
        const expectedIndex = answerChar.charCodeAt(0) - 65;
        const actualIndex = trueOptions[0].index;

        if (expectedIndex !== actualIndex) {
          // Mismatch! Prioritize explicit answer key
          choices.forEach((opt: any, idx: number) => {
            opt.isCorrect = idx === expectedIndex;
          });
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

      if (foundInKey || hasDirectAnswer || (!foundInKey && q.metadata?.answerKeyRef)) {
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
