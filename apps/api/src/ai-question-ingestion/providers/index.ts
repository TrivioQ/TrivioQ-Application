// ── Provider factory ──────────────────────────────────────────────────────────
// Re-exports types and provides a single entry point for creating providers.
// All file names are in lowercase.
//
// To add a new provider:
//   1. Create `your-provider.ts` implementing the `AIProvider` interface.
//   2. Add a case in createProvider() below.
//   That's it — no other files need to change.

export { GoogleProvider } from './google-provider';
export { NvidiaProvider } from './nvidia-provider';
export { DeepseekProvider } from './deepseek-provider';
export { LocalProvider } from './local-provider';
export { OmnirouterProvider } from './omnirouter-provider';
export type { AIProvider, ClassificationResult, EnhancementResult, ExtractionResult, ExtractedAnswerKey, ExtractedChoice, ExtractedQuestion, ImageInput } from './ai-provider';

import type { AIProvider } from './ai-provider';
import { GoogleProvider } from './google-provider';
import { NvidiaProvider } from './nvidia-provider';
import { DeepseekProvider } from './deepseek-provider';
import { LocalProvider } from './local-provider';
import { OmnirouterProvider } from './omnirouter-provider';

// Union of all supported provider names.
// Add your new provider name here when extending.
export type AIProviderName = 'google' | 'nvidia' | 'deepseek' | 'local' | 'omnirouter';

/**
 * Instantiates the requested AI provider.
 *
 * @param name - Provider to use. Defaults to `'google'`.
 * @returns     An object satisfying the `AIProvider` contract.
 */
export function createProvider(name: AIProviderName = 'google', model?: string): AIProvider {
  switch (name) {
    case 'omnirouter':
      return new OmnirouterProvider(model);
    case 'deepseek':
      return new DeepseekProvider(model);
    case 'nvidia':
      return new NvidiaProvider(model);
    case 'local':
      return new LocalProvider(model);
    case 'google':
    default:
      return new GoogleProvider(model);
  }
}
