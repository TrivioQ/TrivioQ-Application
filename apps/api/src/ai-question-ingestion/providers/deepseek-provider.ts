import { BaseAIProvider, ApiRateLimitError, ApiFatalError } from './base-provider';
import type { ImageInput } from './ai-provider';

// ── Deepseek API provider ───────────────────────────────────────────────────────
//
// Connects to the Deepseek endpoint, which exposes an OpenAI-compatible
// chat-completions API.
//
// Required env var:  DEEPSEEK_API_KEY
// Optional env var:  DEEPSEEK_MODEL   (default: deepseek-chat)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const FALLBACK_MODEL = 'deepseek-chat';

export class DeepseekProvider extends BaseAIProvider {
  readonly model: string;
  private readonly apiKey: string;

  constructor(model?: string, apiKey?: string) {
    super();
    this.model = model ?? FALLBACK_MODEL;
    this.apiKey = apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number }): Promise<string> {
    await this.enforceRateLimit(1500);

    const payload = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      max_tokens: 32768,
    };

    if (images.length > 0) {
      throw new Error('[DeepseekProvider] DeepSeek API does not support image inputs. ' + 'Please configure a vision-capable provider (like google or nvidia) for the scout and extraction phases.');
    }

    const url = DEEPSEEK_API_URL;
    const apiKey = this.apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      const errorText = await response.text();
      let retryAfterMs;
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed)) {
          retryAfterMs = parsed * 1000;
        }
      }
      throw new ApiRateLimitError(response.status, retryAfterMs, errorText);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiFatalError(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    return data.choices[0].message.content.trim();
  }
}
