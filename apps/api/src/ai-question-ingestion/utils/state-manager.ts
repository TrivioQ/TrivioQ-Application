import fs from 'fs';
import path from 'path';

export type QuestionStatus = 'AWAITING_KEY' | 'READY_FOR_ENHANCEMENT' | 'READY_FOR_UPLOAD' | 'UPLOADED';

export interface Question {
  id: string;
  text: string;
  status: QuestionStatus;
  answer?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionStateData {
  bookId: string;
  lastProcessedImageIndex: number;
  lastProcessedExtractionBatchIndex?: number;
  questions: Question[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const defaultStateData = (bookId: string): IngestionStateData => ({
  bookId,
  lastProcessedImageIndex: -1,
  lastProcessedExtractionBatchIndex: -1,
  questions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export class IngestionState {
  private readonly stateFilePath: string;

  constructor(
    private readonly bookId: string,
    private readonly outputDir: string,
  ) {
    if (!bookId || bookId.trim() === '') {
      throw new Error('bookId is required');
    }
    this.stateFilePath = path.resolve(this.outputDir, `${this.bookId}_state.json`);
  }

  private writeState(state: IngestionStateData): void {
    state.updatedAt = new Date().toISOString();
    // Atomic write: write to .tmp first, then rename so a mid-write SIGKILL
    // cannot leave a partially-written (corrupt) state file behind.
    const tmpPath = `${this.stateFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
    fs.renameSync(tmpPath, this.stateFilePath);
  }

  initOrLoad(): IngestionStateData {
    if (fs.existsSync(this.stateFilePath)) {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      try {
        return JSON.parse(raw) as IngestionStateData;
      } catch {
        // Corrupt file (partial write from a prior SIGKILL). Reset to defaults so
        // the job can restart from scratch rather than getting permanently stuck.
        console.error(`[StateManager] Corrupt state file at ${this.stateFilePath} — resetting to defaults.`);
        const state = defaultStateData(this.bookId);
        this.writeState(state);
        return state;
      }
    }

    const state = defaultStateData(this.bookId);
    this.writeState(state);
    return state;
  }

  upsertQuestion(question: Question): void {
    this.upsertQuestions([question]);
  }

  upsertQuestions(questions: Question[]): void {
    if (questions.length === 0) return;

    const state = this.initOrLoad();

    for (const question of questions) {
      const index = state.questions.findIndex((q) => q.id === question.id);
      if (index >= 0) {
        state.questions[index] = { ...state.questions[index], ...question };
      } else {
        state.questions.push(question);
      }
    }

    this.writeState(state);
  }

  updateStatus(questionId: string, status: QuestionStatus): void {
    const state = this.initOrLoad();
    const question = state.questions.find((q) => q.id === questionId);

    if (!question) {
      throw new Error(`Question with id "${questionId}" not found`);
    }

    question.status = status;
    this.writeState(state);
  }

  setLastProcessedImageIndex(index: number): void {
    const state = this.initOrLoad();
    state.lastProcessedImageIndex = index;
    this.writeState(state);
  }

  getLastProcessedImageIndex(): number {
    const state = this.initOrLoad();
    return state.lastProcessedImageIndex;
  }

  setLastProcessedExtractionBatchIndex(index: number): void {
    const state = this.initOrLoad();
    state.lastProcessedExtractionBatchIndex = index;
    this.writeState(state);
  }

  getLastProcessedExtractionBatchIndex(): number {
    const state = this.initOrLoad();
    return state.lastProcessedExtractionBatchIndex ?? -1;
  }

  getQuestionsByStatus(status: QuestionStatus): Question[] {
    const state = this.initOrLoad();
    return state.questions.filter((q) => q.status === status);
  }

  getAllQuestions(): Question[] {
    const state = this.initOrLoad();
    return state.questions;
  }

  updateMetadata(metadata: Record<string, unknown>): void {
    const state = this.initOrLoad();
    state.metadata = { ...(state.metadata ?? {}), ...metadata };
    this.writeState(state);
  }

  resetToPhase(phase: 'SCOUT' | 'EXTRACTION' | 'ENHANCEMENT' | 'UPLOAD'): void {
    const state = this.initOrLoad();

    switch (phase) {
      case 'SCOUT':
        state.lastProcessedImageIndex = -1;
        state.lastProcessedExtractionBatchIndex = -1;
        state.questions = [];
        if (state.metadata) {
          state.metadata.imageClassifications = {};
          state.metadata.answerKeys = [];
          state.metadata.processedKeyPages = [];
        }
        break;

      case 'EXTRACTION':
        state.lastProcessedExtractionBatchIndex = -1;
        // Keep existing scout metadata, clear only extracted questions
        state.questions = [];
        break;

      case 'ENHANCEMENT':
        // Revert any question that is past extraction back to READY_FOR_ENHANCEMENT
        for (const q of state.questions) {
          if (q.status === 'READY_FOR_UPLOAD' || q.status === 'UPLOADED') {
            q.status = 'READY_FOR_ENHANCEMENT';
            // Clear enhancement metadata
            if (q.metadata) {
              delete q.metadata.hint;
              delete q.metadata.explanation;
              delete q.metadata.aiQualityScore;
              delete q.metadata.topic;
              delete q.metadata.categorySlugs;
              delete q.metadata.difficulty;
              delete q.metadata.ageRating;
              delete q.metadata.isFactuallyCorrect;
              delete q.metadata.factCheckRationale;
              delete q.metadata.isSelfReferential;
            }
          }
        }
        break;

      case 'UPLOAD':
        // Revert any uploaded question back to READY_FOR_UPLOAD
        for (const q of state.questions) {
          if (q.status === 'UPLOADED') {
            q.status = 'READY_FOR_UPLOAD';
          }
        }
        break;
    }

    this.writeState(state);
  }
}
