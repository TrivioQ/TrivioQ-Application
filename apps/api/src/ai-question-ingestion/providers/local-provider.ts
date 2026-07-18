import { BaseAIProvider, ApiFatalError, ApiRateLimitError } from './base-provider';
import type { ImageInput } from './ai-provider';

// A tiny 1x1 valid base64 PNG to use as a fallback if no image is provided,
// because the local endpoint strictly requires a file.
const DUMMY_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export class LocalProvider extends BaseAIProvider {
  readonly model: string;
  private readonly baseUrl: string;

  constructor(model?: string) {
    super();
    this.model = model || 'local-vlm';
    this.baseUrl = process.env.LOCAL_LLM_URL || 'http://localhost:3713/v1/analyze-page';
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number }): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    if (options?.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    } else {
      formData.append('temperature', '0.0');
    }
    // Hardcoding max_tokens to 2048 as it's the server default, but passing it explicitly as requested.
    formData.append('max_tokens', '4096');

    let base64Data = DUMMY_IMAGE_BASE64;
    let mimeType = 'image/png';

    if (images.length > 0) {
      base64Data = images[0].base64;
      mimeType = images[0].mimeType || 'image/jpeg';
      if (images.length > 1) {
        console.warn(`[LocalProvider] Received ${images.length} images, but local server only supports 1. Using the first image.`);
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, 'image.jpg');

    console.log(`[LocalProvider] Calling local model at ${this.baseUrl}`);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new ApiRateLimitError(response.status, 2000, errorText);
        }
        if (response.status >= 500 && response.status < 600) {
          // We throw a generic Error so the BaseProvider can retry it (max 8 times)
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        if (response.status >= 400 && response.status < 500) {
          throw new ApiFatalError(`HTTP ${response.status}: ${errorText}`);
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      if (!json.text) {
        throw new Error('[LocalProvider] call: empty response text');
      }

      return json.text;
    } catch (error: any) {
      if (error instanceof ApiRateLimitError || error instanceof ApiFatalError) {
        throw error;
      }
      // Re-throw generic errors (like ECONNREFUSED) to trigger the BaseProvider's retry loop
      throw new Error(`[LocalProvider] Fetch error: ${error.message}`);
    }
  }
}
