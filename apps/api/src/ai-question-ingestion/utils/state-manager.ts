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
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
  }

  initOrLoad(): IngestionStateData {
    if (fs.existsSync(this.stateFilePath)) {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as IngestionStateData;
      return parsed;
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
}
