import type { AIProvider, ClassificationResult, EnhancementResult, ExtractionResult, ImageInput } from './ai-provider';
import { ENHANCEMENT_PROMPT, EXTRACTION_PROMPT, SCOUT_PROMPT } from '../prompts';

// ── Deepseek API provider ───────────────────────────────────────────────────────
//
// Connects to the Deepseek endpoint, which exposes
// an OpenAI-compatible chat-completions API.
//
// Required env var:  DEEPSEEK_API_KEY
// Optional env var:  DEEPSEEK_MODEL   (default: deepseek-chat)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown fences that some models wrap around JSON output. */
function stripMarkdownFences(text: string): string {
  if (text.startsWith('```json')) {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  if (text.startsWith('```')) {
    return text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return text;
}

/** Build an OpenAI-style message content array that includes optional images. */
function buildContent(prompt: string, images: ImageInput[] = []): string | object[] {
  if (images.length > 0) {
    throw new Error('[DeepseekProvider] DeepSeek API does not support image inputs. Please configure a vision-capable provider (like google or nvidia) for the scout and extraction phases.');
  }

  return prompt;
}

// ── DeepseekProvider ────────────────────────────────────────────────────────────

export class DeepseekProvider implements AIProvider {
  private readonly model: string;
  private readonly apiKey: string;
  private lastCallTime = 0;

  constructor(model?: string, apiKey?: string) {
    this.model = model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    this.apiKey = apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
  }

  // ── Core fetch helper ───────────────────────────────────────────────────────

  private async call(prompt: string, images: ImageInput[] = []): Promise<string> {
    // Rate limit control (adjust as needed for Deepseek)
    const minDelay = 1500;
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < minDelay) {
      const waitTime = minDelay - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();

    const payload = {
      model: this.model,
      messages: [{ role: 'user', content: buildContent(prompt, images) }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    };

    const maxRetries = 8;
    let delay = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt === maxRetries) {
            const errorText = await response.text();
            throw new Error(`[DeepseekProvider] HTTP ${response.status} (after ${maxRetries} attempts): ${errorText}`);
          }
          let retryDelay = delay;
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            const parsed = parseInt(retryAfter, 10);
            if (!isNaN(parsed)) {
              retryDelay = Math.max(retryDelay, parsed * 1000);
            }
          }
          console.warn(`[DeepseekProvider] HTTP ${response.status} (Attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          delay = Math.max(delay * 2, retryDelay);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`[DeepseekProvider] HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as any;
        const rawText: string = data.choices[0].message.content;
        return stripMarkdownFences(rawText.trim());
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`[DeepseekProvider] Error (Attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : error}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error('[DeepseekProvider] Unreachable code reached in retry loop');
  }

  // ── AIProvider implementation ───────────────────────────────────────────────

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const text = await this.call(SCOUT_PROMPT, [image]);
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn('[DeepseekProvider] Failed to parse JSON from classifyImage:', text);
      throw e;
    }
    return result as ClassificationResult;
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const prompt = promptOverride ?? EXTRACTION_PROMPT;
    const text = await this.call(prompt, images);
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn('[DeepseekProvider] Failed to parse JSON from extractFromImages:', text);
      throw e;
    }
    return result as ExtractionResult;
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const basePrompt = promptOverride ?? ENHANCEMENT_PROMPT;
    const userMessage = `${basePrompt}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}\n\nReturn a JSON object with: hint, explanation, aiQualityScore, difficulty`;
    const text = await this.call(userMessage);
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn('[DeepseekProvider] Failed to parse JSON from enhanceQuestion:', text);
      throw e;
    }
    return result as EnhancementResult;
  }
}
