import type { ImageInput } from '../ai-provider';
import { ApiFatalError } from '../base-provider';
import type { ProviderConnection } from './connection';

/**
 * Anthropic Messages API adapter — STUB.
 *
 * Not implemented because no Anthropic provider is consumed in the current
 * runtime and @anthropic-ai/sdk is not installed. The `anthropic` protocol
 * remains selectable in the admin UI so a provider row can be configured ahead
 * of a future implementation, but resolveProvider() refuses to wire it up.
 */
export async function callAnthropic(_conn: ProviderConnection, _prompt: string, _images: ImageInput[] = [], _options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
  throw new ApiFatalError('Anthropic adapter is not implemented. Install @anthropic-ai/sdk and wire callAnthropic() ' + 'in apps/api/src/ai-question-ingestion/providers/adapters/anthropic-adapter.ts.');
}
