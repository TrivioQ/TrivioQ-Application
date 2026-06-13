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
  protected abstract call(prompt: string, images?: ImageInput[], options?: { temperature?: number }): Promise<string>;

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
    const text = this.stripMarkdownFences(raw).trim();
    try {
      return JSON.parse(text) as T;
    } catch (e: any) {
      // Attempt to recover from "Unexpected non-whitespace character after JSON"
      // (e.g., when the LLM outputs an extra closing brace at the end)
      if (e instanceof Error && e.message.includes('Unexpected non-whitespace character after JSON')) {
        const match = e.message.match(/position (\d+)/);
        if (match) {
          const pos = parseInt(match[1], 10);
          try {
            return JSON.parse(text.slice(0, pos)) as T;
          } catch (recoveryErr) {
            console.error(`[${this.constructor.name}] ${op} recovery error:`, recoveryErr);
            // If recovery fails, fall through to the original error log
          }
        }
      }

      console.error(`[${this.constructor.name}] ${op} parse error:`, text);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // AIProvider implementation
  // ---------------------------------------------------------------------------

  private async callWithRetry<T>(prompt: string, images: ImageInput[], op: string, options?: { temperature?: number }): Promise<T> {
    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const text = await this.call(prompt, images, options);
        return this.parseJson<T>(text, op);
      } catch (e: any) {
        if (e instanceof SyntaxError || e.name === 'SyntaxError') {
          console.warn(`[${this.constructor.name}] ${op} attempt ${attempt} failed with SyntaxError. Retrying...`);
          lastError = e;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000));
          }
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const tempStr = process.env.INGESTION_SCOUT_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    return this.callWithRetry<ClassificationResult>(SCOUT_PROMPT, [image], 'classifyImage', { temperature });
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const tempStr = process.env.INGESTION_EXTRACTION_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    return this.callWithRetry<ExtractionResult>(promptOverride ?? EXTRACTION_PROMPT, images, 'extractFromImages', { temperature });
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const tempStr = process.env.INGESTION_ENHANCEMENT_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    const prompt = `${promptOverride ?? ENHANCEMENT_PROMPT}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}`;
    return this.callWithRetry<EnhancementResult>(prompt, [], 'enhanceQuestion', { temperature });
  }
}
