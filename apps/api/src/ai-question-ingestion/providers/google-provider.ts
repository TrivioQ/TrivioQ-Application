import { GoogleGenAI } from '@google/genai';
import { BaseAIProvider } from './base-provider';
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

    const maxRetries = 5;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.ai.models.generateContent(params);
      } catch (error: any) {
        if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
          if (attempt === maxRetries) throw error;

          let retryDelay = delay;
          const match = error.message?.match(/retry in (\d+(\.\d+)?)s/i);
          if (match) {
            retryDelay = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
          }
          console.warn(`[GoogleProvider] HTTP ${error.status} (Attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          delay *= 2;
        } else {
          throw error;
        }
      }
    }
  }

  protected async call(prompt: string, images: ImageInput[] = [], options?: { temperature?: number }): Promise<string> {
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

    const response = await this.generateContentWithRetry({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
      },
    });

    if (!response.text) {
      throw new Error('[GoogleProvider] call: empty response');
    }

    return response.text;
  }
}
