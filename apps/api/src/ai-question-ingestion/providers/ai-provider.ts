// ── ai-provider — shared interface & result types ────────────────────────────
// Every AI provider (Google, Nvidia, Anthropic, …) must implement this contract.
// The orchestrator depends only on this interface — never on a concrete provider.

import type { ValidationResult } from '../prompts';

// ── Shared input type ─────────────────────────────────────────────────────────

export interface ImageInput {
  base64: string;
  mimeType: string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface ClassificationResult {
  classification: 'QUESTIONS' | 'QUESTIONS_WITH_KEYS' | 'QUESTIONS_WITH_KEY_UNDERNEATH' | 'OTHER';
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

export interface SummarizationResult {
  summary: string[];
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
  /**
   * `true` when the question's answer is only meaningful in the context of the specific
   * source document being processed (e.g. "Who published this encyclopedia?", "How many
   * glossary entries does this book have?"). Such questions are discarded before upload.
   *
   * `false` for genuine world-knowledge questions — even those that reference real authors,
   * publishers, or books as subjects (e.g. "Which publisher released Sapiens?").
   */
  isSelfReferential: boolean;
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
   * Returns one of: 'QUESTIONS' | 'QUESTIONS_WITH_KEYS' | 'QUESTIONS_WITH_KEY_UNDERNEATH' | 'OTHER'
   *
   * @param promptOverride - Optional full prompt to use instead of the default
   *   SCOUT_PROMPT (e.g. with a book-level special instruction prepended).
   */
  classifyImage(image: ImageInput, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } }): Promise<ClassificationResult>;

  /**
   * Extract trivia questions and answer keys from one or more page images.
   *
   * @param promptOverride - Optional full prompt to use instead of the default
   *   EXTRACTION_PROMPT (e.g. with a book-level special instruction prepended).
   */
  extractFromImages(images: ImageInput[], promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } }): Promise<ExtractionResult>;

  /**
   * Generate a hint, explanation, quality score, and difficulty for a question.
   *
   * @param promptOverride - Optional full prompt to use instead of the default
   *   ENHANCEMENT_PROMPT (e.g. with a book-level special instruction prepended).
   */
  enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } }): Promise<EnhancementResult>;

  /**
   * Summarize an image.
   *
   * @param promptOverride - Optional full prompt to use instead of the default SUMMARIZE_IMAGE_PROMPT.
   */
  summarizeImage(image: ImageInput, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } }): Promise<SummarizationResult>;

  /**
   * Extract trivia questions and answer keys from text.
   *
   * @param promptOverride - Optional full prompt to use.
   */
  extractFromText(text: string, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } }): Promise<ExtractionResult>;

  /**
   * Validate a pending question including its hint and explanation.
   *
   * @param promptOverride - Optional full prompt to use instead of the default VALIDATION_PROMPT.
   */
  validateQuestion(
    questionText: string,
    choices: unknown[],
    hint: string | null,
    explanation: string | null,
    promptOverride?: string,
    options?: { temperature?: number; signal?: AbortSignal; loggingPhase?: string; logger?: { info: (phase: string, message: string) => void; warn: (phase: string, message: string) => void; error: (phase: string, message: string) => void } },
  ): Promise<ValidationResult>;
}
