import type { AIProviderName } from '../providers';

export interface OrchestratorConfig {
  outputDir: string;
  processType: string;
  topic?: string;
  /** One or more category slugs. Multiple slugs create one PendingQuestion row per slug. */
  categorySlugs?: string[];
  /**
   * Per-phase provider overrides.
   */
  providers?: {
    /** Provider for image classification (Scout phase). */
    scout?: AIProviderName;
    /** Provider for question extraction (Extraction phase). */
    extraction?: AIProviderName;
    /** Provider for question enhancement + difficulty (Enhancement phase). */
    enhancement?: AIProviderName;
    /** Provider for question generation (Generation phase). */
    generation?: AIProviderName;
    /** Provider for summarizing image content (Summarization phase). */
    summarization?: AIProviderName;
  };
  models?: {
    /** Model override for image classification (Scout phase). */
    scout?: string;
    /** Model override for question extraction (Extraction phase). */
    extraction?: string;
    /** Model override for question enhancement + difficulty (Enhancement phase). */
    enhancement?: string;
    /** Model override for question generation (Generation phase). */
    generation?: string;
    /** Model override for summarizing image content (Summarization phase). */
    summarization?: string;
  };
  callDelays?: {
    scout?: number;
    extraction?: number;
    enhancement?: number;
    generation?: number;
    summarization?: number;
  };
  temperatures?: {
    scout?: number;
    extraction?: number;
    enhancement?: number;
    generation?: number;
    summarization?: number;
  };
  extractionBatchSize?: number;
  enhancementConcurrency?: number;
  /** Optional free-text instruction for the extraction phase. */
  extractionSpecialInstruction?: string;
  /** Optional free-text instruction for the enhancement phase. */
  enhancementSpecialInstruction?: string;
  /** Optional free-text instruction for the classification phase. */
  classificationSpecialInstruction?: string;
  /** Optional free-text instruction for the summarization phase. */
  summarizationSpecialInstruction?: string;
}

export interface IngestionProcess {
  run(options?: { reuploadOnly?: boolean; signal?: AbortSignal }, onProgress?: (phase: string, current: number, total: number) => Promise<void> | void): Promise<void>;
}

/**
 * Schema for `manifest.json` placed inside each book sub-folder.
 */
export interface ManifestJson {
  /** Unique identifier for this book (used as state-file prefix). */
  bookId: string;
  /** Process type to use for this book (e.g. 'question-extraction'). Defaults to 'question-extraction'. */
  processType?: string;
  /** Human-readable topic passed to the database row. */
  topic?: string;
  /**
   * One or more category slugs that must already exist in the Category table.
   * A PendingQuestion row is created for each slug.
   */
  categorySlugs?: string[];
  /**
   * Optional free-text instruction injected into the extraction prompt only
   * (e.g. "Extract only chapters 3–6. Strip exam year markers.").
   */
  extractionSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the enhancement prompt only
   * (e.g. "This book contains Indian competitive exam questions.").
   */
  enhancementSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the classification prompt only
   * (e.g. "Some pages have inline answers. Do not classify as QUESTIONS_WITH_KEYS.").
   */
  classificationSpecialInstruction?: string;
  /**
   * Optional free-text instruction injected into the summarization prompt only.
   */
  summarizationSpecialInstruction?: string;

  /**
   * Per-phase AI provider overrides for this book.
   */
  providers?: {
    scout?: AIProviderName;
    extraction?: AIProviderName;
    enhancement?: AIProviderName;
    generation?: AIProviderName;
    summarization?: AIProviderName;
  };

  /**
   * Optional page range to limit which pages of the PDF are converted to
   * images and sent for AI processing.
   */
  pages?: {
    from?: number;
    to?: number;
  };
}
