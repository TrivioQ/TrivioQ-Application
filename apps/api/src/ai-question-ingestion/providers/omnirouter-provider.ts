import { BaseAIProvider, ApiRateLimitError, ApiFatalError } from './base-provider';
import type { ImageInput } from './ai-provider';

// ── OmniRouter API provider ───────────────────────────────────────────────────
//
// Connects to the local or remote OmniRouter endpoint, which exposes
// an OpenAI-compatible chat-completions API.
//
// Optional env var:  OMNIROUTER_API_KEY (default: empty string)
// Optional env var:  OMNIROUTER_API_URL (default: http://localhost:20128/v1/chat/completions)
// Optional env var:  OMNIROUTER_MODEL   (default: default)

/** Build an OpenAI-style message content array that includes optional images. */
function buildContent(prompt: string, images: ImageInput[] = []): string | object[] {
  if (images.length === 0) {
    return prompt;
  }

  const parts: object[] = [{ type: 'text', text: prompt }];
  for (const img of images) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }
  return parts;
}

export class OmnirouterProvider extends BaseAIProvider {
  readonly model: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(model?: string, apiKey?: string, apiUrl?: string) {
    super();
    this.model = model ?? 'local-model';
    this.apiKey = apiKey ?? process.env.OMNIROUTER_API_KEY ?? '';
    this.apiUrl = apiUrl ?? process.env.OMNIROUTER_API_URL ?? 'http://localhost:20128/v1/chat/completions';
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
    const payload = {
      model: this.model,
      messages: [{ role: 'user', content: buildContent(prompt, images) }],
      max_tokens: 32000,
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      response_format: { type: 'json_object' },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options?.signal,
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
