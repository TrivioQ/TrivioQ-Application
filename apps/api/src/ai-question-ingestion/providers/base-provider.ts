import { ImageInput } from './ai-provider';
import { SCOUT_PROMPT, EXTRACTION_PROMPT, ENHANCEMENT_PROMPT } from '../prompts';
import type { ClassificationResult, EnhancementResult, ExtractionResult } from './ai-provider';

/**
 * Base class for all AI providers.
 *
 * Subclasses only need to implement the {@link call} method.
 * Everything else — prompt assembly, markdown-fence stripping, JSON
 * parsing, error formatting — is handled here.
 */
export abstract class BaseAIProvider {
  protected lastCallTime = 0;

  /**
   * Send a prompt (and optional images) to a backend and return the
   * **raw** text response.  Markdown fences, trimming and JSON parsing
   * are handled by the base class.
   */
  protected abstract call(prompt: string, images?: ImageInput[]): Promise<string>;

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  protected stripMarkdownFences(text: string): string {
    if (text.startsWith('```json')) {
      return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    if (text.startsWith('```')) {
      return text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return text;
  }

  protected async enforceRateLimit(minDelayMs: number): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < minDelayMs) {
      await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
    }
    this.lastCallTime = Date.now();
  }

  private parseJson<T>(raw: string, op: string): T {
    const text = this.stripMarkdownFences(raw);
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.error(`[${this.constructor.name}] ${op} parse error:`, text);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // AIProvider implementation
  // ---------------------------------------------------------------------------

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const text = await this.call(SCOUT_PROMPT, [image]);
    return this.parseJson(text, 'classifyImage');
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const text = await this.call(promptOverride ?? EXTRACTION_PROMPT, images);
    return this.parseJson(text, 'extractFromImages');
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const prompt = `${promptOverride ?? ENHANCEMENT_PROMPT}\n\n` + `Question: ${questionText}\n` + `Choices: ${JSON.stringify(choices)}\n\n` + 'Return a JSON object with: hint, explanation, aiQualityScore, difficulty';
    const text = await this.call(prompt);
    return this.parseJson(text, 'enhanceQuestion');
  }
}
