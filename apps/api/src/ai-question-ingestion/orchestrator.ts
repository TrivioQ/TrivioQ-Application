import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from './utils/stateManager';
import { checkIsDuplicate } from '../utils/checkIsDuplicate';
import { shuffleArray } from '../utils/shuffle';
import { reportError } from '../utils/errorReporter';
import fs from 'fs';
import { createProvider, type AIProvider, type AIProviderName } from './providers';
import { buildExtractionPrompt, buildEnhancementPrompt } from './prompts';

// ── Re-exports (kept for backwards-compatibility with existing callers) ────────
export type { ExtractedQuestion, ExtractedAnswerKey, EnhancementResult } from './providers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageType = 'QUESTIONS' | 'ANSWER_KEY' | 'OTHER';

export interface ImageGroup {
  questions: string[];
  answerKeys: string[];
}

// ── Configuration ─────────────────────────────────────────────────────────────

const UPLOAD_BATCH_SIZE = 20;
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

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: {
      outputDir: string;
      topic: string;
      /** One or more category slugs. Multiple slugs create one PendingQuestion row per slug. */
      categorySlugs: string[];
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
      /**
       * Optional free-text instruction injected into the extraction prompt.
       * @deprecated Use `extractionSpecialInstruction` instead.
       */
      specialInstruction?: string;
      /** Optional free-text instruction for the extraction phase. */
      extractionSpecialInstruction?: string;
      /** Optional free-text instruction for the enhancement phase. */
      enhancementSpecialInstruction?: string;
    },
  ) {
    this.state = new IngestionState(bookId, config.outputDir);

    // Resolve the global fallback once
    const globalDefault: AIProviderName = config.aiProvider ?? (process.env.INGESTION_AI_PROVIDER as AIProviderName | undefined) ?? 'google';

    this.scoutProvider = createProvider(config.providers?.scout ?? (process.env.INGESTION_SCOUT_PROVIDER as AIProviderName | undefined) ?? globalDefault);

    this.extractionProvider = createProvider(config.providers?.extraction ?? (process.env.INGESTION_EXTRACTION_PROVIDER as AIProviderName | undefined) ?? globalDefault);

    this.enhancementProvider = createProvider(config.providers?.enhancement ?? (process.env.INGESTION_ENHANCEMENT_PROVIDER as AIProviderName | undefined) ?? globalDefault);

    this.extractionSpecialInstruction = config.extractionSpecialInstruction ?? config.specialInstruction;
    this.enhancementSpecialInstruction = config.enhancementSpecialInstruction ?? config.specialInstruction;
  }

  private availableCategories: { slug: string; name: string }[] = [];

  async run(): Promise<void> {
    this.state.initOrLoad();
    console.log(`[Orchestrator] Starting ingestion for ${this.imagePaths.length} images`);
    console.log(`[Orchestrator] Categories: ${this.config.categorySlugs.join(', ')}`);
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

    await this.scoutPhase();
    await this.extractionPhase();
    await this.enhancementPhase();
    await this.uploadPhase();

    console.log('[Orchestrator] Ingestion complete');
  }

  // ── Phase 1: Scout ────────────────────────────────────────────────────────

  private async scoutPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const startIndex = stateData.lastProcessedImageIndex + 1;

    console.log(`[Scout] Starting from image ${startIndex}`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      const imagePath = this.imagePaths[i];

      try {
        const image = this.imageToBase64(imagePath);
        const stateData = this.state.initOrLoad();
        const existingMeta = (stateData.metadata as Record<string, unknown>) ?? {};
        const imageClassifications = (existingMeta.imageClassifications as Record<string, ImageType>) ?? {};

        const { classification } = await this.scoutProvider.classifyImage(image);
        imageClassifications[imagePath] = classification;

        this.state.updateMetadata({ ...existingMeta, imageClassifications });
        this.state.setLastProcessedImageIndex(i);

        console.log(`[Scout] Image ${i} classified as ${classification}`);
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

    const questionImages: string[] = [];
    const answerKeyImages: string[] = [];

    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification === 'QUESTIONS') questionImages.push(imagePath);
      if (classification === 'ANSWER_KEY') answerKeyImages.push(imagePath);
    }

    if (questionImages.length === 0) {
      console.log('[Extraction] No QUESTION images found');
      return;
    }

    console.log(`[Extraction] Processing ${questionImages.length} questions, ${answerKeyImages.length} answer keys`);

    // Build the prompt once — optionally prefixed with the book's special instruction
    const extractionPrompt = buildExtractionPrompt(this.extractionSpecialInstruction);
    const groups = this.buildImageGroups(questionImages, answerKeyImages);

    for (const group of groups) {
      try {
        const allImages = [...group.questions, ...group.answerKeys];
        const images = allImages.map((img) => this.imageToBase64(img));

        // Pass the (possibly enriched) prompt through via the extraction provider
        const extracted = await this.extractionProvider.extractFromImages(images, extractionPrompt);

        for (const eq of extracted.questions) {
          const question: Question = {
            id: eq.id,
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

        if (extracted.answerKeys.length > 0) {
          const existingMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const existingAKs = (existingMeta.answerKeys as any[]) ?? [];
          existingAKs.push(...extracted.answerKeys);
          this.state.updateMetadata({ ...existingMeta, answerKeys: existingAKs });
        }

        this.reconcileAnswerKeys();
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'extraction',
          group,
        });
      }
    }
  }

  private buildImageGroups(questionImages: string[], answerKeyImages: string[]): ImageGroup[] {
    if (answerKeyImages.length === 0 || questionImages.length === 0) {
      return questionImages.map((q) => ({ questions: [q], answerKeys: [] }));
    }

    const groups: ImageGroup[] = [];
    let currentGroup: string[] = [];

    for (let i = 0; i < questionImages.length; i++) {
      currentGroup.push(questionImages[i]);

      const nextImg = questionImages[i + 1] ?? answerKeyImages[0];
      if (answerKeyImages.includes(nextImg)) {
        const akForGroup: string[] = [];
        while (answerKeyImages.length > 0) {
          akForGroup.push(answerKeyImages.shift()!);
          break; // take one answer key per group for simplicity
        }
        groups.push({ questions: [...currentGroup], answerKeys: akForGroup });
        currentGroup = [];
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ questions: currentGroup, answerKeys: [] });
    }

    return groups;
  }

  private reconcileAnswerKeys(): void {
    const stateData = this.state.initOrLoad();
    const answerKeys = ((stateData.metadata?.answerKeys as any[]) ?? []) as Array<{
      answers: Record<string, string>;
    }>;

    for (const q of stateData.questions) {
      if (q.status !== 'AWAITING_KEY') continue;

      let hasAnswer = false;
      for (const ak of answerKeys) {
        if (ak.answers[q.id]) {
          this.state.upsertQuestion({ ...q, answer: ak.answers[q.id], status: 'READY_FOR_ENHANCEMENT' });
          hasAnswer = true;
          break;
        }
      }

      // If answer came directly from extraction choices, no answer key needed
      if (!hasAnswer && q.metadata?.answerKeyRef) {
        this.state.upsertQuestion({ ...q, status: 'READY_FOR_ENHANCEMENT' });
      }
    }
  }

  // ── Phase 3: Enhancement ──────────────────────────────────────────────────

  private async enhancementPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');

    console.log(`[Enhancement] Enhancing ${questionsToEnhance.length} questions`);

    // Build the prompt once — optionally prefixed with the book's special instruction, injecting available categories
    const enhancementPrompt = buildEnhancementPrompt(this.availableCategories, this.enhancementSpecialInstruction);

    for (const question of questionsToEnhance) {
      try {
        const enhanced = await this.enhancementProvider.enhanceQuestion(question.text, (question.metadata?.choices as unknown[]) ?? [], enhancementPrompt);

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

    for (let i = 0; i < readyQuestions.length; i += UPLOAD_BATCH_SIZE) {
      const batch = readyQuestions.slice(i, i + UPLOAD_BATCH_SIZE);

      try {
        const duplicateFlags = await Promise.all(batch.map((q) => checkIsDuplicate(q.text)));
        const nonDuplicates: Question[] = batch.filter((_, j) => !duplicateFlags[j]);

        if (nonDuplicates.length === 0) {
          console.log(`[Upload] Batch ${i / UPLOAD_BATCH_SIZE + 1}: all duplicates`);
          continue;
        }

        // One PendingQuestion row per question (no duplication).
        const rows = nonDuplicates.map((q) => ({
          topic: (q.metadata?.topic as string) || this.config.topic || 'General',
          categorySlugs: (q.metadata?.categorySlugs as string[]) || [],
          // Use AI-inferred difficulty stored in metadata; fall back to MEDIUM
          difficultyLevel: sanitiseDifficulty(q.metadata?.difficulty as string | undefined),
          suggestedText: q.text,
          suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
          hint: (q.metadata?.hint as string) ?? null,
          explanation: (q.metadata?.explanation as string) ?? null,
          status: 'PENDING',
          isDuplicate: false,
          isValidated: false,
          aiQualityScore: (q.metadata?.aiQualityScore as number) ?? undefined,
          aiFeedback: null,
        }));

        await prisma.pendingQuestion.createMany({ data: rows as any });

        for (const q of nonDuplicates) {
          this.state.updateStatus(q.id, 'UPLOADED');
        }

        console.log(`[Upload] Batch ${i / UPLOAD_BATCH_SIZE + 1}: inserted ${rows.length} row(s) (${nonDuplicates.length} question(s))`);
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'upload',
          batchIndex: i,
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
