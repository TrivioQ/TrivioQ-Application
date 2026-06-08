// ── ai-provider — shared interface & result types ────────────────────────────
// Every AI provider (Google, Nvidia, Anthropic, …) must implement this contract.
// The orchestrator depends only on this interface — never on a concrete provider.

// ── Shared input type ─────────────────────────────────────────────────────────

export interface ImageInput {
  base64: string;
  mimeType: string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface ClassificationResult {
  classification: 'QUESTIONS' | 'ANSWER_KEY' | 'OTHER';
  confidence: number;
}

export interface ExtractedChoice {
  text: string;
  isCorrect: boolean;
}

export interface ExtractedQuestion {
  id: string;
  text: string;
  choices: ExtractedChoice[];
  answerKeyRef?: string;
  pageNumber?: number;
}

export interface ExtractedAnswerKey {
  id: string;
  answers: Record<string, string>;
  questionRefs: string[];
  pageNumber?: number;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  answerKeys: ExtractedAnswerKey[];
}

export interface EnhancementResult {
  hint: string;
  explanation: string;
  aiQualityScore: number;
}

// ── Provider interface ────────────────────────────────────────────────────────

/**
 * Contract every AI provider must satisfy.
 *
 * To add a new provider:
 *   1. Create `providers/your-provider.ts` that implements this interface.
 *   2. Add a case to the `createProvider` factory in `providers/index.ts`.
 *   No other files need to change.
 */
export interface AIProvider {
  /**
   * Classify a single page image.
   * Returns one of: 'QUESTIONS' | 'ANSWER_KEY' | 'OTHER'
   */
  classifyImage(image: ImageInput): Promise<ClassificationResult>;

  /**
   * Extract trivia questions and answer keys from one or more page images.
   */
  extractFromImages(images: ImageInput[]): Promise<ExtractionResult>;

  /**
   * Generate a hint, explanation, and quality score for a question.
   */
  enhanceQuestion(questionText: string, choices: unknown[]): Promise<EnhancementResult>;
}
