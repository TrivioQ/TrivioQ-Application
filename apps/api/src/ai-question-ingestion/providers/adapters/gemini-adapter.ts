import { GoogleGenAI } from '@google/genai';
import type { ImageInput } from '../ai-provider';
import { ApiRateLimitError, ApiFatalError } from '../base-provider';
import type { ProviderConnection } from './connection';

/**
 * Google Gemini adapter using the native @google/genai SDK.
 *
 * Kept as a distinct protocol (rather than the OpenAI-compatible endpoint)
 * because the native path gives inlineData vision handling and safety settings
 * the OpenAI shim does not expose — vision matters for scout/extraction/summarize.
 *
 * A single GoogleGenAI client is constructed per connection. The provider-
 * account-level pacing floor (minCallIntervalMs) is applied by GenericAIProvider
 * before this is invoked — not here.
 */
export async function callGemini(
  conn: ProviderConnection,
  prompt: string,
  images: ImageInput[] = [],
  options?: { temperature?: number; signal?: AbortSignal },
): Promise<string> {
  if (!conn.apiKey) {
    throw new ApiFatalError(`Provider "${conn.displayName}" has no API key configured.`);
  }

  const ai = new GoogleGenAI({ apiKey: conn.apiKey });

  const parts: any[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    });
  }

  const config: Record<string, unknown> = { responseMimeType: 'application/json' };
  if (options?.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  // Surface per-model knobs (e.g. safetySettings) from extraParams without overriding SDK-standard config keys.
  if (conn.extraParams) {
    for (const [k, v] of Object.entries(conn.extraParams)) {
      if (!(k in config)) config[k] = v;
    }
  }

  const generatePromise = ai.models.generateContent({
    model: conn.modelName,
    contents: [{ role: 'user', parts }],
    config: config as any,
  });

  // Abort handling: the SDK does not race an AbortSignal itself across lib
  // versions reliably, so we preserve the exact pattern from the legacy
  // google-provider.ts:63-71 — Promise.race against an abort promise that
  // rejects on signal. base-provider's executeApiCallWithRetry then sees the
  // AbortError and short-circuits without retrying.
  let response: any;
  if (options?.signal) {
    const signal = options.signal;
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new Error('Aborted'));
      signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    });
    response = await Promise.race([generatePromise, abortPromise]);
  } else {
    response = await generatePromise;
  }

  if (!response?.text) {
    throw new Error(`[${conn.displayName}] call: empty response`);
  }
  return response.text;
}

/**
 * Wrap the call so 429/5xx surface as ApiRateLimitError and 4xx as ApiFatalError,
 * matching the legacy GoogleProvider.generateContentWithRetry error mapping.
 * (The retry pacing itself is owned by BaseAIProvider.executeApiCallWithRetry.)
 */
export async function callGeminiWithRetryMapping(
  conn: ProviderConnection,
  prompt: string,
  images: ImageInput[] = [],
  options?: { temperature?: number; signal?: AbortSignal },
): Promise<string> {
  try {
    return await callGemini(conn, prompt, images, options);
  } catch (error: any) {
    if (error instanceof ApiRateLimitError || error instanceof ApiFatalError) {
      throw error;
    }
    if (error?.message === 'Aborted') {
      throw error;
    }
    const status: number | undefined = error?.status;
    if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
      let retryAfterMs: number | undefined;
      const match = error?.message?.match(/retry in (\d+(\.\d+)?)s/i);
      if (match) {
        retryAfterMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
      }
      throw new ApiRateLimitError(status, retryAfterMs, error?.message);
    }
    if (status !== undefined && status >= 400 && status < 500) {
      throw new ApiFatalError(error?.message ?? `HTTP ${status}`);
    }
    throw error;
  }
}
