import { GoogleGenAI } from '@google/genai';
import type { AIProvider, ClassificationResult, EnhancementResult, ExtractionResult, ImageInput } from './ai-provider';
import { ENHANCEMENT_PROMPT, EXTRACTION_PROMPT, SCOUT_PROMPT } from '../prompts';

// ── Model constants ───────────────────────────────────────────────────────────

/** Fast multimodal model used for image classification (Scout phase). */
const FAST_MODEL = 'gemini-2.5-flash';

/** Heavy multimodal model used for question extraction (Extraction phase). */
const HEAVY_MODEL = 'gemini-2.5-flash';

/** Model used for question enhancement (Enhancement phase). */
const ENHANCEMENT_MODEL = 'gemini-2.5-flash';

// ── Google GenAI provider ─────────────────────────────────────────────────────

export class GoogleProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private lastCallTime = 0;

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({ apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '' });
  }

  private async generateContentWithRetry(params: any): Promise<any> {
    // Rate limit control (15 RPM = 4s per request)
    const minDelay = 4000;
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < minDelay) {
      const waitTime = minDelay - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();

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

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const response = await this.generateContentWithRetry({
      model: FAST_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: SCOUT_PROMPT },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.base64,
              },
            },
          ],
        },
      ],
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) {
      throw new Error('[GoogleProvider] classifyImage: empty response');
    }

    return JSON.parse(response.text) as ClassificationResult;
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const prompt = promptOverride ?? EXTRACTION_PROMPT;
    const parts: any[] = [
      { text: prompt },
      ...images.map((img) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      })),
    ];

    const response = await this.generateContentWithRetry({
      model: HEAVY_MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) {
      throw new Error('[GoogleProvider] extractFromImages: empty response');
    }

    return JSON.parse(response.text) as ExtractionResult;
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const basePrompt = promptOverride ?? ENHANCEMENT_PROMPT;
    const userMessage = `Question: ${questionText}\nChoices: ${JSON.stringify(choices)}\n\nReturn a JSON object with: hint, explanation, aiQualityScore, difficulty`;

    const response = await this.generateContentWithRetry({
      model: ENHANCEMENT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: basePrompt }, { text: userMessage }],
        },
      ],
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) {
      throw new Error('[GoogleProvider] enhanceQuestion: empty response');
    }

    return JSON.parse(response.text) as EnhancementResult;
  }
}
