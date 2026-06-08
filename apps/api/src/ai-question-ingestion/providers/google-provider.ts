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

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({ apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '' });
  }

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const response = await this.ai.models.generateContent({
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

    const response = await this.ai.models.generateContent({
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

    const response = await this.ai.models.generateContent({
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
