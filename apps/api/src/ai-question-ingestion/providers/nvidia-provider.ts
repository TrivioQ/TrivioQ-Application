import { BaseAIProvider, ApiRateLimitError, ApiFatalError } from './base-provider';
import type { ImageInput } from './ai-provider';

// ── NVIDIA API provider ───────────────────────────────────────────────────────
//
// Connects to the NVIDIA NIM / integrate.api.nvidia.com endpoint, which exposes
// an OpenAI-compatible chat-completions API.
//
// Required env var:  NVIDIA_API_KEY
// Optional env var:  NVIDIA_MODEL   (default: moonshotai/kimi-k2.6)

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODEL = 'moonshotai/kimi-k2.6';

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

export class NvidiaProvider extends BaseAIProvider {
  readonly model: string;
  private readonly apiKey: string;

  constructor(model?: string, apiKey?: string) {
    super();
    this.model = model ?? FALLBACK_MODEL;
    this.apiKey = apiKey ?? process.env.NVIDIA_API_KEY ?? '';
  }

  /** Returns true for DeepSeek models served through the NVIDIA NIM endpoint. */
  private isDeepSeek(): boolean {
    return this.model.toLowerCase().includes('deepseek');
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
    const isDeepSeekModel = this.isDeepSeek();
    const payload = {
      model: this.model,
      messages: [{ role: 'user', content: buildContent(prompt, images) }],
      max_tokens: 32000,
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      response_format: { type: 'json_object' },
      ...(isDeepSeekModel && { chat_template_kwargs: { thinking: false } }),
    };

    const url = NVIDIA_API_URL;
    const apiKey = this.apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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
