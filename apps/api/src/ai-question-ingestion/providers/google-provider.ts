import { GoogleGenAI } from '@google/genai';
import { BaseAIProvider, ApiRateLimitError, ApiFatalError } from './base-provider';
import type { ImageInput } from './ai-provider';

// ── Google GenAI provider ─────────────────────────────────────────────────────

const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export class GoogleProvider extends BaseAIProvider {
  private readonly ai: GoogleGenAI;
  readonly model: string;

  constructor(model?: string, apiKey?: string) {
    super();
    this.model = model ?? FALLBACK_MODEL;
    this.ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || '' });
  }

  private async generateContentWithRetry(params: any): Promise<any> {
    await this.enforceRateLimit(4000);

    try {
      return await this.ai.models.generateContent(params);
    } catch (error: any) {
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        let retryDelay;
        const match = error.message?.match(/retry in (\d+(\.\d+)?)s/i);
        if (match) {
          retryDelay = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
        }
        throw new ApiRateLimitError(error.status, retryDelay, error.message);
      }
      if (error.status >= 400 && error.status < 500) {
        throw new ApiFatalError(error.message);
      }
      throw error;
    }
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number; signal?: AbortSignal }): Promise<string> {
    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    }

    console.log(`[GoogleProvider] Calling model: ${this.model}`);

    const generatePromise = this.generateContentWithRetry({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
      },
    });

    let response;
    if (options?.signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        if (options.signal!.aborted) reject(new Error('Aborted'));
        options.signal!.addEventListener('abort', () => reject(new Error('Aborted')));
      });
      response = await Promise.race([generatePromise, abortPromise]);
    } else {
      response = await generatePromise;
    }

    if (!response.text) {
      throw new Error('[GoogleProvider] call: empty response');
    }

    return response.text;
  }
}
