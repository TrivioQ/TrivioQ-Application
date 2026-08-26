import { BaseAIProvider } from './base-provider';
import type { ImageInput } from './ai-provider';
import type { ProviderConnection } from './adapters/connection';
import { callOpenAI } from './adapters/openai-adapter';
import { callGeminiWithRetryMapping } from './adapters/gemini-adapter';
import { callLocalForm } from './adapters/local-form-adapter';
import { callAnthropic } from './adapters/anthropic-adapter';

/**
 * One generic provider class for every protocol.
 *
 * Extends BaseAIProvider unchanged — all retry, markdown-fence stripping, JSON
 * recovery, and the six public methods (classifyImage, extractFromImages, …)
 * are inherited. This class only implements `call()`:
 *   1. apply the provider-account-level pacing floor (minCallIntervalMs) —
 *      this is the legacy enforceRateLimit(1500)/(4000) behavior, now data-driven;
 *   2. dispatch to the protocol adapter;
 *   3. return the raw response text.
 *
 * `name` is set to the provider displayName so BaseAIProvider's
 * `[this.constructor.name]` log lines keep printing a recognizable label
 * (e.g. `[NVIDIA NIM]`) instead of the generic class name.
 */
export class GenericAIProvider extends BaseAIProvider {
  readonly model: string;
  private readonly conn: ProviderConnection;

  constructor(conn: ProviderConnection) {
    super();
    this.conn = conn;
    this.model = conn.modelName;
    Object.defineProperty(this, 'name', { value: conn.displayName, configurable: true });
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
    if (this.conn.minCallIntervalMs > 0) {
      await this.enforceRateLimit(this.conn.minCallIntervalMs);
    }

    switch (this.conn.protocol) {
      case 'openai':
        return callOpenAI(this.conn, prompt, images, options);
      case 'gemini':
        return callGeminiWithRetryMapping(this.conn, prompt, images, options);
      case 'local_form':
        return callLocalForm(this.conn, prompt, images, options);
      case 'anthropic':
        return callAnthropic(this.conn, prompt, images, options);
      default: {
        const exhaustive: never = this.conn.protocol;
        throw new Error(`[${this.conn.displayName}] Unsupported protocol: ${exhaustive}`);
      }
    }
  }
}
