import type { ImageInput } from '../ai-provider';
import { ApiRateLimitError, ApiFatalError } from '../base-provider';
import type { ProviderConnection } from './connection';

/**
 * Local-form adapter for a multipart FormData VLM endpoint.
 *
 * This is its own protocol because the wire shape genuinely diverges from
 * OpenAI: multipart body (not JSON), `file` blob field, single image only,
 * and the response is `{ text: string }` rather than `{ choices: [{ message:
 * { content } }] }`. It does NOT support response_format / json_object — the
 * caller relies on BaseAIProvider.parseJson's markdown-fence & brace recovery.
 */

// A 1x1 valid base64 PNG — the local endpoint strictly requires a file, so this
// is the fallback when a phase calls with no image (e.g. text-only enhancement).
const DUMMY_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export async function callLocalForm(conn: ProviderConnection, prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('temperature', (options?.temperature ?? 0).toString());
  formData.append('max_tokens', String(conn.maxOutputTokens ?? 4096));

  let base64Data = DUMMY_IMAGE_BASE64;
  let mimeType = 'image/png';

  if (images.length > 0) {
    base64Data = images[0].base64;
    mimeType = images[0].mimeType || 'image/jpeg';
    if (images.length > 1) {
      console.warn(`[${conn.displayName}] Received ${images.length} images, but the local endpoint supports only 1. Using the first image.`);
    }
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, 'image.jpg');

  let response: Response;
  try {
    response = await fetch(conn.baseUrl!, {
      method: 'POST',
      headers: { accept: 'application/json', ...(conn.defaultHeaders ?? {}) },
      body: formData,
      signal: options?.signal,
    });
  } catch (error: any) {
    if (error instanceof ApiRateLimitError || error instanceof ApiFatalError) throw error;
    // Re-throw generic errors (ECONNREFUSED etc.) so BaseAIProvider's retry loop fires.
    throw new Error(`[${conn.displayName}] Fetch error: ${error.message}`);
  }

  if (response.status === 429) {
    const errorText = await response.text();
    throw new ApiRateLimitError(response.status, 2000, errorText);
  }
  if (response.status >= 500 && response.status < 600) {
    // Generic Error -> BaseAIProvider retries up to 8×.
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  if (response.status >= 400 && response.status < 500) {
    const errorText = await response.text();
    throw new ApiFatalError(`HTTP ${response.status}: ${errorText}`);
  }

  const json = (await response.json()) as any;
  if (!json?.text) {
    throw new Error(`[${conn.displayName}] call: empty response text`);
  }
  return json.text as string;
}
