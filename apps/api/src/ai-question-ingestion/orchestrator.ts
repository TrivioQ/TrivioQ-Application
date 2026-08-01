import { OrchestratorConfig, IngestionProcess } from './processes/process.interface';
import { QuestionExtractionProcess } from './processes/question-extraction';
import { QuizGenerationProcess } from './processes/quiz-generation';

export type { ExtractedQuestion, ExtractedAnswerKey, EnhancementResult } from './providers';
export type { OrchestratorConfig, IngestionProcess };

export class IngestionOrchestrator {
  private readonly process: IngestionProcess;

  constructor(bookId: string, imagePaths: string[], config: OrchestratorConfig) {
    const processType = config.processType || 'question-extraction';

    switch (processType) {
      case 'question-extraction':
        this.process = new QuestionExtractionProcess(bookId, imagePaths, config);
        break;
      case 'quiz-generation':
        this.process = new QuizGenerationProcess(bookId, imagePaths, config);
        break;
      default:
        throw new Error(`Unknown processType: ${processType}`);
    }
  }

  async run(options?: { reuploadOnly?: boolean }, onProgress?: (phase: string, current: number, total: number) => void): Promise<void> {
    return this.process.run(options, onProgress);
  }
}
