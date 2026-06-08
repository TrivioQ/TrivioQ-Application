import type { AIProvider, ClassificationResult, EnhancementResult, ExtractionResult, ImageInput } from './ai-provider';
import { ENHANCEMENT_PROMPT, EXTRACTION_PROMPT, SCOUT_PROMPT } from '../prompts';

// ── NVIDIA API provider ───────────────────────────────────────────────────────
//
// Connects to the NVIDIA NIM / integrate.api.nvidia.com endpoint, which exposes
// an OpenAI-compatible chat-completions API.
//
// Required env var:  NVIDIA_API_KEY
// Optional env var:  NVIDIA_MODEL   (default: moonshotai/kimi-k2.6)

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.6';

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

// ── NvidiaProvider ────────────────────────────────────────────────────────────

export class NvidiaProvider implements AIProvider {
  private readonly model: string;
  private readonly apiKey: string;
  private lastCallTime = 0;

  constructor(model?: string, apiKey?: string) {
    this.model = model ?? process.env.NVIDIA_MODEL ?? DEFAULT_MODEL;
    this.apiKey = apiKey ?? process.env.NVIDIA_API_KEY ?? '';
  }

  // ── Core fetch helper ───────────────────────────────────────────────────────

  private async call(prompt: string, images: ImageInput[] = []): Promise<string> {
    // Rate limit control (40 RPM = 1.5s per request)
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
      max_tokens: 4096,
      temperature: 0.2,
    };

    const maxRetries = 5;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(NVIDIA_API_URL, {
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
            throw new Error(`[NvidiaProvider] HTTP ${response.status} (after ${maxRetries} attempts): ${errorText}`);
          }
          console.warn(`[NvidiaProvider] HTTP ${response.status} (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`[NvidiaProvider] HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as any;
        const rawText: string = data.choices[0].message.content;
        return stripMarkdownFences(rawText.trim());
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`[NvidiaProvider] Error (Attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : error}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error('[NvidiaProvider] Unreachable code reached in retry loop');
  }

  // ── AIProvider implementation ───────────────────────────────────────────────

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const text = await this.call(SCOUT_PROMPT, [image]);
    return JSON.parse(text) as ClassificationResult;
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const prompt = promptOverride ?? EXTRACTION_PROMPT;
    const text = await this.call(prompt, images);
    return JSON.parse(text) as ExtractionResult;
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const basePrompt = promptOverride ?? ENHANCEMENT_PROMPT;
    const userMessage = `${basePrompt}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}\n\nReturn a JSON object with: hint, explanation, aiQualityScore, difficulty`;
    const text = await this.call(userMessage);
    return JSON.parse(text) as EnhancementResult;
  }
}
