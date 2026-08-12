// ── Provider registry entry point ────────────────────────────────────────────
// The old createProvider() factory and the 5 concrete provider classes are
// gone — vendors are now DB rows (AIProvider/AIModel) resolved through the
// registry (see registry.ts) and dispatched by protocol via the adapters.
// This module remains as the type-only entry point for the AIProvider contract
// and its result shape types, re-exported from ai-provider.ts.

export type {
  AIProvider,
  ClassificationResult,
  EnhancementResult,
  ExtractionResult,
  ExtractedAnswerKey,
  ExtractedChoice,
  ExtractedQuestion,
  ImageInput,
} from './ai-provider';
