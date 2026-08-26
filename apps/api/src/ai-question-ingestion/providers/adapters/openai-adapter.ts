import type { ImageInput } from '../ai-provider';
import { ApiRateLimitError, ApiFatalError } from '../base-provider';
import type { ProviderConnection } from './connection';

/**
 * OpenAI-compatible chat-completions adapter.
 *
 * One wire protocol serving OpenAI, NVIDIA NIM (integrate.api.nvidia.com),
 * DeepSeek, Omnirouter, and any future OpenAI-compatible vendor. Differences
 * (base URL, auth, maxTokens, json-mode, per-model knobs) are data on the
 * AIProvider/AIModel rows — this adapter reads them from the connection.
 *
 * `extraParams` is merged into the body FIRST, so standard fields can override
 * it. Reserved keys (model/messages/max_tokens/response_format/temperature) are
 * rejected at the API layer before a row is written, so collisions are impossible.
 */

/** Build an OpenAI-style message `content` with optional inline images. */
export function buildOpenAIContent(prompt: string, images: ImageInput[] = []): string | object[] {
  if (images.length === 0) return prompt;
  const parts: object[] = [{ type: 'text', text: prompt }];
  for (const img of images) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }
  return parts;
}

export async function callOpenAI(conn: ProviderConnection, prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
  if (!conn.supportsVision && images.length > 0) {
    throw new ApiFatalError(`Provider "${conn.displayName}" does not support image inputs. ` + 'Configure a vision-capable provider/model for scout, extraction, or summarization phases.');
  }

  const body: Record<string, unknown> = {
    model: conn.modelName,
    messages: [{ role: 'user', content: buildOpenAIContent(prompt, images) }],
    temperature: options?.temperature !== undefined ? options.temperature : 0.2,
    max_tokens: conn.maxOutputTokens ?? 32000,
  };
  if (conn.supportsJsonMode) {
    body.response_format = { type: 'json_object' };
  }
  // extraParams merged FIRST so the standard fields above override any collision.
  if (conn.extraParams) {
    for (const [k, v] of Object.entries(conn.extraParams)) {
      if (!(k in body)) body[k] = v;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(conn.defaultHeaders ?? {}),
  };
  if (conn.apiKey) {
    headers['Authorization'] = `Bearer ${conn.apiKey}`;
  }

  const response = await fetch(conn.baseUrl!, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
    const errorText = await response.text();
    let retryAfterMs: number | undefined;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) retryAfterMs = parsed * 1000;
    }
    throw new ApiRateLimitError(response.status, retryAfterMs, errorText);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiFatalError(`HTTP ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new ApiFatalError('OpenAI-compatible endpoint returned no message content.');
  }
  return content.trim();
}
