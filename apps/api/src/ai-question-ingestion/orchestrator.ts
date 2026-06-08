import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from './utils/stateManager';
import { checkIsDuplicate } from '../utils/checkIsDuplicate';
import { shuffleArray } from '../utils/shuffle';
import { reportError } from '../utils/errorReporter';
import fs from 'fs';
import { createProvider, type AIProvider, type AIProviderName } from './providers';

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

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class IngestionOrchestrator {
  private readonly state: IngestionState;
  private readonly provider: AIProvider;

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: {
      outputDir: string;
      topic: string;
      difficultyLevel?: DifficultyLevel;
      categorySlug: string;
      /** AI provider to use. Defaults to 'google'. */
      aiProvider?: AIProviderName;
    },
  ) {
    this.state = new IngestionState(bookId, config.outputDir);
    this.provider = createProvider(config.aiProvider ?? 'google');
  }

  async run(): Promise<void> {
    this.state.initOrLoad();
    console.log(`[Orchestrator] Starting ingestion for ${this.imagePaths.length} images`);

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

        const { classification } = await this.provider.classifyImage(image);
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

    const groups = this.buildImageGroups(questionImages, answerKeyImages);

    for (const group of groups) {
      try {
        const allImages = [...group.questions, ...group.answerKeys];
        const images = allImages.map((img) => this.imageToBase64(img));

        const extracted = await this.provider.extractFromImages(images);

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

    for (const question of questionsToEnhance) {
      try {
        const enhanced = await this.provider.enhanceQuestion(question.text, (question.metadata?.choices as unknown[]) ?? []);

        this.state.upsertQuestion({
          ...question,
          status: 'READY_FOR_UPLOAD',
          metadata: {
            ...question.metadata,
            hint: enhanced.hint,
            explanation: enhanced.explanation,
            aiQualityScore: enhanced.aiQualityScore,
          },
        });

        console.log(`[Enhancement] Enhanced ${question.id}`);
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

        const rows = nonDuplicates.map((q) => ({
          topic: this.config.topic,
          categorySlug: this.config.categorySlug,
          difficultyLevel: (this.config.difficultyLevel ?? 'MEDIUM') as DifficultyLevel,
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

        console.log(`[Upload] Batch ${i / UPLOAD_BATCH_SIZE + 1}: inserted ${rows.length}`);
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
