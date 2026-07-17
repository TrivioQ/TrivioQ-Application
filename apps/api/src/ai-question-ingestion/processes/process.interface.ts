import type { AIProviderName } from '../providers';

export interface OrchestratorConfig {
  outputDir: string;
  processType: string;
  topic?: string;
  /** One or more category slugs. Multiple slugs create one PendingQuestion row per slug. */
  categorySlugs?: string[];
  /**
   * Fallback AI provider for all phases.
   * Falls back to INGESTION_AI_PROVIDER env var, then 'google'.
   */
  aiProvider?: AIProviderName;
  /**
   * Per-phase provider overrides. Each key takes precedence over `aiProvider`
   * and the INGESTION_AI_PROVIDER env var.
   *
   * Per-phase env var fallback order (example for scout):
   *   providers.scout → aiProvider → INGESTION_SCOUT_PROVIDER → INGESTION_AI_PROVIDER → 'google'
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
  run(options?: { reuploadOnly?: boolean }): Promise<void>;
}
