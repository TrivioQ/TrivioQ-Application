import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from '../utils/state-manager';
import { checkIsDuplicate } from '../../utils/check-is-duplicate';
import { checkPendingDuplicate } from '../../utils/check-pending-duplicate';
import { shuffleArray } from '../../utils/shuffle';
import { reportError } from '../../utils/error-reporter';
import fs from 'fs';
import { createProvider, type AIProvider, type AIProviderName } from '../providers';
import { buildQuizGenerationFromTextPrompt, buildSummarizeImagePrompt, buildEnhancementPrompt } from '../prompts';
import { OrchestratorConfig, IngestionProcess } from './process.interface';

const DEFAULT_CALL_DELAY = 10;
const VALID_DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

function sanitiseDifficulty(raw: string | undefined): DifficultyLevel {
  if (raw && (VALID_DIFFICULTIES as string[]).includes(raw)) {
    return raw as DifficultyLevel;
  }
  console.warn(`[QuizGeneration] Invalid difficulty "${raw}" — defaulting to MEDIUM`);
  return 'MEDIUM';
}

export class QuizGenerationProcess implements IngestionProcess {
  private readonly state: IngestionState;
  private readonly summarizationProvider: AIProvider;
  private readonly generationProvider: AIProvider;
  private readonly enhancementProvider: AIProvider;
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

    const globalDefault: AIProviderName = config.aiProvider ?? (process.env.INGESTION_AI_PROVIDER as AIProviderName | undefined) ?? 'google';

    const summarizationModel = config.models?.summarization ?? process.env.INGESTION_SUMMARIZATION_MODEL;
    const generationModel = config.models?.generation ?? process.env.INGESTION_GENERATION_MODEL;
    const enhancementModel = config.models?.enhancement ?? process.env.INGESTION_ENHANCEMENT_MODEL;

    this.summarizationProvider = createProvider(config.providers?.summarization ?? (process.env.INGESTION_SUMMARIZATION_PROVIDER as AIProviderName | undefined) ?? globalDefault, summarizationModel);
    this.generationProvider = createProvider(config.providers?.generation ?? (process.env.INGESTION_GENERATION_PROVIDER as AIProviderName | undefined) ?? globalDefault, generationModel);
    this.enhancementProvider = createProvider(config.providers?.enhancement ?? (process.env.INGESTION_ENHANCEMENT_PROVIDER as AIProviderName | undefined) ?? globalDefault, enhancementModel);

    this.summarizationSpecialInstruction = config.summarizationSpecialInstruction;
    // Using extraction instruction as the generation instruction for backward compatibility / ease of use
    this.generationSpecialInstruction = config.extractionSpecialInstruction;
    this.enhancementSpecialInstruction = config.enhancementSpecialInstruction;

    this.callDelayMs = {
      summarization: (process.env.INGESTION_SUMMARIZATION_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_SUMMARIZATION_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
      generation: (process.env.INGESTION_GENERATION_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_GENERATION_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
      enhancement: (process.env.INGESTION_ENHANCEMENT_CALL_DELAY_SEC ? parseInt(process.env.INGESTION_ENHANCEMENT_CALL_DELAY_SEC, 10) : DEFAULT_CALL_DELAY) * 1000,
    };
  }

  private availableCategories: { slug: string; name: string }[] = [];
  private lastCallTime = 0;

  private async delayIfNeeded(phase: 'summarization' | 'generation' | 'enhancement'): Promise<void> {
    if (this.lastCallTime > 0) {
      const elapsed = Date.now() - this.lastCallTime;
      const delay = this.callDelayMs[phase] - elapsed;
      if (delay > 0) {
        const prefix = phase === 'summarization' || phase === 'generation' ? 'Generation' : 'Enhancement';
        console.log(`[${prefix}] Delaying ${Math.ceil(delay / 1000)} seconds to rate-limit AI calls...`);
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

  async run(options?: { reuploadOnly?: boolean }): Promise<void> {
    this.state.initOrLoad();
    console.log(`[QuizGeneration] Starting ingestion for ${this.imagePaths.length} images`);
    console.log(`[QuizGeneration] Categories: ${(this.config.categorySlugs ?? []).join(', ')}`);
    console.log(`[QuizGeneration] Providers — generation: ${this.generationProvider.constructor.name}, enhancement: ${this.enhancementProvider.constructor.name}`);

    this.availableCategories = await prisma.category.findMany({
      select: { slug: true, name: true },
    });
    console.log(`[QuizGeneration] Fetched ${this.availableCategories.length} categories from DB`);

    if (options?.reuploadOnly) {
      console.log('[QuizGeneration] Reupload mode: preparing questions for upload...');
      const stateData = this.state.initOrLoad();
      for (const q of stateData.questions) {
        if (q.status === 'UPLOADED' || q.status === 'READY_FOR_UPLOAD') {
          this.state.updateStatus(q.id, 'READY_FOR_UPLOAD');
        }
      }
      await this.uploadPhase();
    } else {
      await this.generationPhase();
      await this.enhancementPhase();
      await this.uploadPhase();
    }

    console.log('[QuizGeneration] Ingestion complete');
  }

  private async generationPhase(): Promise<void> {
    const startIndex = this.state.getLastProcessedExtractionBatchIndex() + 1;

    console.log(`[Generation] Starting from image ${startIndex + 1} of ${this.imagePaths.length}`);
    const tempStr = process.env.INGESTION_GENERATION_TEMPERATURE;
    console.log(`[Generation] Stage Config — Provider: ${this.generationProvider.constructor.name}, Model: ${this.generationProvider.model}, Temperature: ${tempStr ?? 'default'}, Delay: ${this.callDelayMs.generation}ms`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      const imagePath = this.imagePaths[i];

      try {
        const image = this.imageToBase64(imagePath);

        // Extract page number from path if possible
        const match = imagePath.match(/page\.(\d+)\./);
        const pageNumber = match ? parseInt(match[1], 10) : i + 1;

        // Summarization Step
        await this.delayIfNeeded('summarization');
        console.log(`[Generation] Summarizing image ${i + 1}...`);
        const summarizationPrompt = buildSummarizeImagePrompt(this.summarizationSpecialInstruction);

        let summarization;
        try {
          summarization = await this.summarizationProvider.summarizeImage(image, summarizationPrompt);
        } finally {
          this.recordCallTime();
        }

        // Generation Step
        await this.delayIfNeeded('generation');
        console.log(`[Generation] Generating quiz questions from summary ${i + 1}...`);

        const generationPrompt = buildQuizGenerationFromTextPrompt(this.generationSpecialInstruction, pageNumber);

        let generated;
        try {
          generated = await this.generationProvider.extractFromText(summarization.summary, generationPrompt);
        } finally {
          this.recordCallTime();
        }

        const questions = generated.questions || [];
        for (let qIdx = 0; qIdx < questions.length; qIdx++) {
          const gq = questions[qIdx];

          // Ensure a unique ID
          const qNum = gq.originalQuestionNumber ?? gq.id.replace(/^gen_p\d+_/, '') ?? String(qIdx + 1);
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

        this.state.setLastProcessedExtractionBatchIndex(i);
        console.log(`[Generation] Generated ${questions.length} questions from image ${i + 1}`);
      } catch (error) {
        console.error(`[Generation] Error processing image ${imagePath}:`, error);
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'generation',
          imageIndex: i,
          imagePath,
        });
      }
    }
  }

  private async enhancementPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');

    const tempStr = process.env.INGESTION_ENHANCEMENT_TEMPERATURE;
    console.log(`[Enhancement] Stage Config — Provider: ${this.enhancementProvider.constructor.name}, Model: ${this.enhancementProvider.model}, Temperature: ${tempStr ?? 'default'}, Delay: ${this.callDelayMs.enhancement}ms`);

    console.log(`[Enhancement] Enhancing ${questionsToEnhance.length} questions`);

    const enhancementPrompt = buildEnhancementPrompt(this.availableCategories, this.enhancementSpecialInstruction);

    for (let idx = 0; idx < questionsToEnhance.length; idx++) {
      const question = questionsToEnhance[idx];
      try {
        await this.delayIfNeeded('enhancement');
        console.log(`[Enhancement] Enhancing question ${question.id} [${idx + 1}/${questionsToEnhance.length}]...`);
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

  private async uploadPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const readyQuestions = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD');

    console.log(`[Upload] Uploading ${readyQuestions.length} questions`);
    if (readyQuestions.length === 0) return;

    for (const q of readyQuestions) {
      try {
        const newScore: number = (q.metadata?.aiQualityScore as number) ?? 0;

        const pendingCheck = await checkPendingDuplicate(q.text);

        if (pendingCheck.found && pendingCheck.record) {
          const existing = pendingCheck.record;
          const existingScore: number = existing.aiQualityScore ?? 0;

          if (existing.status === 'PENDING') {
            if (newScore > existingScore) {
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
              aiQualityScore: newScore,
              aiFeedback: q.metadata?.isFactuallyCorrect === false ? (q.metadata?.factCheckRationale as string) : null,
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
}
