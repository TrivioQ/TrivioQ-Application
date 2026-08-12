export interface OrchestratorConfig {
  outputDir: string;
  processType: string;
  topic?: string;
  /** One or more category slugs. Multiple slugs create one PendingQuestion row per slug. */
  categorySlugs?: string[];
  /**
   * Default modelId per phase (read from IngestionStageConfig). The process
   * resolves an AIProvider instance for each via resolveProvider().
   */
  stageModelIds?: {
    scout?: string;
    extraction?: string;
    enhancement?: string;
    generation?: string;
    summarization?: string;
  };
  /**
   * Per-job modelId overrides (from the ingestion job's manifestData), keyed
   * by phase. When present, overrides the stageModelId for that phase.
   */
  modelOverrides?: {
    scout?: string;
    extraction?: string;
    enhancement?: string;
    generation?: string;
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
   * Per-phase AI model overrides for this book (modelId strings). When present,
   * the worker uses these modelIds instead of the stage default.
   */
  modelOverrides?: {
    scout?: string;
    extraction?: string;
    enhancement?: string;
    generation?: string;
    summarization?: string;
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
