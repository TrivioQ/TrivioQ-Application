import { prisma } from '@trivioq/database';
import { IngestionState, Question } from '../utils/state-manager';
import { checkIsDuplicate } from '../../utils/check-is-duplicate';
import { checkPendingDuplicate } from '../../utils/check-pending-duplicate';
import { shuffleArray } from '../../utils/shuffle';
import { reportError } from '../../utils/error-reporter';
import fs from 'fs';
import type { AIProvider } from '../providers';
import { resolveProvider } from '../providers/registry';
import { buildQuizGenerationFromTextPrompt, buildSummarizeImagePrompt, buildEnhancementPrompt } from '../prompts';
import { sanitiseDifficulty, sanitiseAgeRating } from '../utils/sanitise';
import { OrchestratorConfig, IngestionProcess } from './process.interface';

const DEFAULT_CALL_DELAY = 10;

export class QuizGenerationProcess implements IngestionProcess {
  private readonly state: IngestionState;
  private summarizationProvider?: AIProvider;
  private generationProvider?: AIProvider;
  private enhancementProvider?: AIProvider;
  private readonly summarizationSpecialInstruction?: string;
  private readonly generationSpecialInstruction?: string;
  private readonly enhancementSpecialInstruction?: string;
  private readonly callDelayMs: { summarization: number; generation: number; enhancement: number };

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: OrchestratorConfig,
  ) {
    this.state = new IngestionState(bookId, config.outputDir);

    this.summarizationSpecialInstruction = config.summarizationSpecialInstruction;
    // Using extraction instruction as the generation instruction for backward compatibility / ease of use
    this.generationSpecialInstruction = config.extractionSpecialInstruction;
    this.enhancementSpecialInstruction = config.enhancementSpecialInstruction;

    this.callDelayMs = {
      summarization: (config.callDelays?.summarization ?? DEFAULT_CALL_DELAY) * 1000,
      generation: (config.callDelays?.generation ?? DEFAULT_CALL_DELAY) * 1000,
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

  private async delayIfNeeded(phase: 'summarization' | 'generation' | 'enhancement'): Promise<void> {
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

  private imageToBase64(imagePath: string): { base64: string; mimeType: string } {
    const buffer = fs.readFileSync(imagePath);
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeType = `image/${ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png'}`;
    return { base64: buffer.toString('base64'), mimeType };
  }

  async run(options?: { reuploadOnly?: boolean; signal?: AbortSignal }, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    this.state.initOrLoad();

    // Resolve providers from the registry (async — DB + key decryption).
    this.summarizationProvider = await resolveProvider(this.config.modelOverrides?.summarization ?? this.config.stageModelIds?.summarization ?? '');
    this.generationProvider = await resolveProvider(this.config.modelOverrides?.generation ?? this.config.stageModelIds?.generation ?? '');
    this.enhancementProvider = await resolveProvider(this.config.modelOverrides?.enhancement ?? this.config.stageModelIds?.enhancement ?? '');

    this.logInfo('QuizGeneration', `Starting ingestion for ${this.imagePaths.length} images`);
    this.logInfo('QuizGeneration', `Categories: ${(this.config.categorySlugs ?? []).join(', ')}`);
    this.logInfo('QuizGeneration', `Providers — generation: ${this.generationProvider!.model}, enhancement: ${this.enhancementProvider!.model}`);

    this.availableCategories = await prisma.category.findMany({
      select: { slug: true, name: true },
    });
    this.logInfo('QuizGeneration', `Fetched ${this.availableCategories.length} categories from DB`);

    if (this.availableCategories.length === 0) {
      throw new Error('No categories found in the database. Please run the database seeder first (`pnpm --filter @trivioq/database seed-categories`).');
    }

    if (options?.reuploadOnly) {
      this.logInfo('QuizGeneration', 'Reupload mode: preparing questions for upload...');
      const stateData = this.state.initOrLoad();
      for (const q of stateData.questions) {
        if (q.status === 'UPLOADED' || q.status === 'READY_FOR_UPLOAD') {
          this.state.updateStatus(q.id, 'READY_FOR_UPLOAD');
        }
      }
      await this.uploadPhase(options?.signal, onProgress);
    } else {
      await this.generationPhase(options?.signal, onProgress);
      await this.enhancementPhase(options?.signal, onProgress);
      await this.uploadPhase(options?.signal, onProgress);
    }

    this.logInfo('QuizGeneration', 'Ingestion complete');
  }

  private async generationPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const startIndex = this.state.getLastProcessedExtractionBatchIndex() + 1;
    const summarizationTemp = this.config.temperatures?.summarization;
    const generationTemp = this.config.temperatures?.generation;

    this.logInfo('Generation', `Starting from image ${startIndex + 1} of ${this.imagePaths.length}`);
    this.logInfo('Generation', `Stage Config — Provider: ${this.generationProvider!.constructor.name}, Model: ${this.generationProvider!.model}, Temperature: ${generationTemp ?? 'default'}, Delay: ${this.callDelayMs.generation}ms`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      // Report progress under 'GENERATION' (not 'EXTRACTION') so the DB currentPhase
      // field and Admin UI correctly show the quiz generation step.
      await onProgress?.('GENERATION', i + 1, this.imagePaths.length);
      const imagePath = this.imagePaths[i];

      let attempt = 0;
      const maxRetries = 3;

      while (attempt < maxRetries) {
        try {
          const image = this.imageToBase64(imagePath);

          // Extract page number from path if possible
          const match = imagePath.match(/page\.(\d+)\./);
          const pageNumber = match ? parseInt(match[1], 10) : i + 1;

          const stateData = this.state.initOrLoad();
          const existingMeta = (stateData.metadata as Record<string, unknown>) ?? {};
          const processedPages = (existingMeta.processedPages as number[]) ?? [];
          const hasLegacyQuestions = stateData.questions.some((q) => q.metadata?.pageNumber === pageNumber);

          if (processedPages.includes(pageNumber) || hasLegacyQuestions) {
            this.logInfo('Generation', `Skipping image ${i + 1} (page ${pageNumber}) — already processed successfully.`);
            this.state.setLastProcessedExtractionBatchIndex(i);
            if (!processedPages.includes(pageNumber)) {
              processedPages.push(pageNumber);
              this.state.updateMetadata({ ...existingMeta, processedPages });
            }
            break;
          }

          // Summarization Step
          await this.delayIfNeeded('summarization');
          this.logInfo('Generation', `Summarizing image ${i + 1}/${this.imagePaths.length}...`);
          const summarizationPrompt = buildSummarizeImagePrompt(this.summarizationSpecialInstruction);

          let summarization;
          try {
            summarization = await this.summarizationProvider!.summarizeImage(image, summarizationPrompt, { temperature: summarizationTemp, signal, logger: this.config.logger, loggingPhase: 'GENERATION' });
          } finally {
            this.recordCallTime();
          }

          // Generation Step
          await this.delayIfNeeded('generation');
          this.logInfo('Generation', `Generating quiz questions from summary ${i + 1}...`);

          const generationPrompt = buildQuizGenerationFromTextPrompt(this.generationSpecialInstruction, pageNumber);

          let generated;
          try {
            const summaryText = summarization.summary.join('\n- ');
            generated = await this.generationProvider!.extractFromText(summaryText, generationPrompt, { temperature: generationTemp, signal, logger: this.config.logger, loggingPhase: 'GENERATION' });
          } finally {
            this.recordCallTime();
          }

          const questions = generated.questions || [];
          for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const gq = questions[qIdx];

            // Ensure a unique ID
            const qNum = gq.originalQuestionNumber ?? gq.id?.replace(/^gen_p\d+_/, '') ?? String(qIdx + 1);
            const uniqueId = `gen_p${pageNumber}_${qNum}`;

            const question: Question = {
              id: uniqueId,
              text: gq.text?.trim() ? gq.text : '[Question text missing in generation]',
              // Quiz generation guarantees choices and the correct answer
              status: 'READY_FOR_ENHANCEMENT',
              // Assign the derived answer from choice marked as correct
              answer: String.fromCharCode(
                65 +
                  Math.max(
                    0,
                    gq.choices.findIndex((c) => c.isCorrect),
                  ),
              ).toLowerCase(),
              metadata: {
                choices: gq.choices,
                pageNumber: pageNumber,
                originalQuestionNumber: gq.originalQuestionNumber,
              },
            };
            this.state.upsertQuestion(question);
          }

          processedPages.push(pageNumber);
          this.state.updateMetadata({ ...existingMeta, processedPages });
          this.state.setLastProcessedExtractionBatchIndex(i);
          this.logInfo('Generation', `Generated ${questions.length} questions from image ${i + 1}`);

          break; // Break loop on success
        } catch (error) {
          attempt++;
          if (signal?.aborted || attempt >= maxRetries) {
            this.logError('Generation', `Error processing image ${imagePath} after ${attempt} attempts:`, error);
            reportError(error instanceof Error ? error : new Error(String(error)), {
              phase: 'generation',
              imageIndex: i,
              imagePath,
            });
            throw error;
          }
          this.logError('Generation', `Error processing image ${imagePath}, retrying (${attempt}/${maxRetries})...`, error);
        }
      }
    }
  }

  private async enhancementPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');
    const alreadyEnhancedCount = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD' || q.status === 'UPLOADED').length;
    const totalToEnhance = questionsToEnhance.length + alreadyEnhancedCount;

    const temperature = this.config.temperatures?.enhancement;
    this.logInfo('Enhancement', `Stage Config — Provider: ${this.enhancementProvider!.constructor.name}, Model: ${this.enhancementProvider!.model}, Temperature: ${temperature ?? 'default'}, Delay: ${this.callDelayMs.enhancement}ms`);

    this.logInfo('Enhancement', `Enhancing ${questionsToEnhance.length} remaining questions (of ${totalToEnhance} total)`);

    const enhancementPrompt = buildEnhancementPrompt(this.availableCategories, this.enhancementSpecialInstruction);
    const validCategorySlugs = new Set(this.availableCategories.map((c) => c.slug));

    const concurrency = this.config.enhancementConcurrency ?? 10;

    for (let i = 0; i < questionsToEnhance.length; i += concurrency) {
      const absoluteCurrent = alreadyEnhancedCount + Math.min(i + concurrency, questionsToEnhance.length);
      await onProgress?.('ENHANCEMENT', absoluteCurrent, totalToEnhance);
      const chunk = questionsToEnhance.slice(i, i + concurrency);

      const processedChunk = await Promise.all(
        chunk.map(async (question, chunkIdx) => {
          const idx = i + chunkIdx;
          let attempt = 0;
          const maxRetries = 3;

          while (attempt < maxRetries) {
            try {
              // delayIfNeeded is intentionally omitted here: Promise.all runs calls
              // concurrently, so a shared lastCallTime would be read/written by all
              // parallel invocations simultaneously — making the delay unreliable.
              // Rate limiting is handled correctly at the provider level via
              // GenericAIProvider.enforceRateLimit(minCallIntervalMs).
              const absoluteIdx = alreadyEnhancedCount + idx;
              this.logInfo('Enhancement', `Enhancing question ${question.id} [${absoluteIdx + 1}/${totalToEnhance}] (Attempt ${attempt + 1}/${maxRetries})...`);
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
                  categorySlugs: enhanced.categorySlugs.filter((slug: string) => validCategorySlugs.has(slug)),
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
              attempt++;
              if (signal?.aborted || attempt >= maxRetries) {
                this.logError('Enhancement', `Error processing question ${question.id} after ${attempt} attempts:`, error);
                reportError(error instanceof Error ? error : new Error(String(error)), {
                  phase: 'enhancement',
                  questionId: question.id,
                });
                throw error;
              }
              this.logError('Enhancement', `Error processing question ${question.id}, retrying (${attempt}/${maxRetries})...`, error);
            }
          }
          return null; // Should not be reached due to throw above, but required for type checking
        }),
      );

      const successfulQuestions = processedChunk.filter((q): q is NonNullable<typeof q> => q !== null);
      if (successfulQuestions.length > 0) {
        this.state.upsertQuestions(successfulQuestions);
      }
    }
  }

  private async uploadPhase(signal?: AbortSignal, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void> {
    const stateData = this.state.initOrLoad();
    const readyQuestions = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD');
    const alreadyUploadedCount = stateData.questions.filter((q) => q.status === 'UPLOADED').length;
    const totalToUpload = readyQuestions.length + alreadyUploadedCount;

    this.logInfo('Upload', `Uploading ${readyQuestions.length} remaining questions (of ${totalToUpload} total)`);
    if (readyQuestions.length === 0) return;

    for (let i = 0; i < readyQuestions.length; i++) {
      const absoluteCurrent = alreadyUploadedCount + i + 1;
      await onProgress?.('UPLOAD', absoluteCurrent, totalToUpload);
      const q = readyQuestions[i];
      try {
        this.logInfo('Upload', `Uploading question ${q.id} [${absoluteCurrent}/${totalToUpload}]...`);
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

        const isLiveDuplicate = await checkIsDuplicate(q.text);

        if (isLiveDuplicate) {
          const liveRows = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id
            FROM "Question"
            WHERE similarity("questionText", ${q.text}) > 0.85
            ORDER BY similarity("questionText", ${q.text}) DESC
            LIMIT 1
          `;
          const liveQuestionId = liveRows[0]?.id ?? null;

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
        throw error;
      }
    }
  }
}
