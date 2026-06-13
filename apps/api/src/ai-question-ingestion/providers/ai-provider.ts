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
  classification: 'RELEVANT' | 'OTHER';
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
  originalQuestionNumber?: string | null;
}

export interface ExtractedAnswerKey {
  id: string;
  answers: Record<string, string>;
  pageNumber?: number;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  answerKeys: ExtractedAnswerKey[];
}

export interface EnhancementResult {
  topic: string;
  categorySlugs: string[];
  hint: string;
  explanation: string;
  aiQualityScore: number;
  /** AI-inferred difficulty. Must be validated against DifficultyLevel values before use. */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isFactuallyCorrect: boolean;
  factCheckRationale: string | null;
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
  readonly model: string;
  /**
   * Classify a single page image.
   * Returns one of: 'RELEVANT' | 'OTHER'
   */
  classifyImage(image: ImageInput): Promise<ClassificationResult>;

  /**
   * Extract trivia questions and answer keys from one or more page images.
   *
   * @param promptOverride - Optional full prompt to use instead of the default
   *   EXTRACTION_PROMPT (e.g. with a book-level special instruction prepended).
   */
  extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult>;

  /**
   * Generate a hint, explanation, quality score, and difficulty for a question.
   *
   * @param promptOverride - Optional full prompt to use instead of the default
   *   ENHANCEMENT_PROMPT (e.g. with a book-level special instruction prepended).
   */
  enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult>;
}
