import { ImageInput } from './ai-provider';
import { SCOUT_PROMPT, EXTRACTION_PROMPT, ENHANCEMENT_PROMPT, SUMMARIZE_IMAGE_PROMPT, QUIZ_GENERATION_FROM_TEXT_PROMPT } from '../prompts';
import type { ValidationResult } from '../prompts';
import type { ClassificationResult, EnhancementResult, ExtractionResult, SummarizationResult } from './ai-provider';

export class ApiRateLimitError extends Error {
  constructor(
    public status: number,
    public retryAfterMs?: number,
    message?: string,
  ) {
    super(message);
    this.name = 'ApiRateLimitError';
  }
}

export class ApiFatalError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ApiFatalError';
  }
}

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
    // Try to extract content inside ```json ... ``` or ``` ... ```
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }

    // If no markdown fences are found, try to extract the first { to the last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
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

  protected async executeApiCallWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
    const maxRetries = 8;
    let delay = 60000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        if (error instanceof ApiFatalError) {
          console.error(`[${this.constructor.name}] FATAL: Unrecoverable error. Stopping ingestion process. Error: ${error.message}`);
          process.exit(1);
        }

        if (error instanceof ApiRateLimitError) {
          if (attempt === maxRetries) {
            console.error(`[${this.constructor.name}] FATAL: Max retries exhausted. Stopping ingestion process. HTTP ${error.status}: ${error.message}`);
            process.exit(1);
          }
          let retryDelay = delay;
          if (error.retryAfterMs) {
            retryDelay = Math.max(retryDelay, error.retryAfterMs);
          }
          console.warn(`[${this.constructor.name}] HTTP ${error.status} (Attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          delay = Math.max(delay * 2, retryDelay);
          continue;
        }

        // Generic error (network timeout, etc.)
        if (attempt === maxRetries) {
          console.error(`[${this.constructor.name}] FATAL: Max retries exhausted. Stopping ingestion process. Error: ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
        console.warn(`[${this.constructor.name}] Error (Attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : error}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error(`[${this.constructor.name}] Unreachable code reached in retry loop`);
  }

  private async callWithRetry<T>(prompt: string, images: ImageInput[], op: string, options?: { temperature?: number }): Promise<T> {
    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const text = await this.executeApiCallWithRetry(() => this.call(prompt, images, options));
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

  async classifyImage(image: ImageInput, promptOverride?: string): Promise<ClassificationResult> {
    const tempStr = process.env.INGESTION_SCOUT_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    return this.callWithRetry<ClassificationResult>(promptOverride ?? SCOUT_PROMPT, [image], 'classifyImage', { temperature });
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

  async summarizeImage(image: ImageInput, promptOverride?: string): Promise<SummarizationResult> {
    const tempStr = process.env.INGESTION_SUMMARIZATION_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    return this.callWithRetry<SummarizationResult>(promptOverride ?? SUMMARIZE_IMAGE_PROMPT, [image], 'summarizeImage', { temperature });
  }

  async extractFromText(text: string, promptOverride?: string): Promise<ExtractionResult> {
    const tempStr = process.env.INGESTION_EXTRACTION_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    const prompt = `${promptOverride ?? QUIZ_GENERATION_FROM_TEXT_PROMPT}\n\n## Content to use for Generation\n\n${text}`;
    return this.callWithRetry<ExtractionResult>(prompt, [], 'extractFromText', { temperature });
  }

  async validateQuestion(questionText: string, choices: unknown[], hint: string | null, explanation: string | null, promptOverride?: string): Promise<ValidationResult> {
    const tempStr = process.env.INGESTION_ENHANCEMENT_TEMPERATURE;
    const temperature = tempStr !== undefined ? parseFloat(tempStr) : undefined;
    const prompt = `${promptOverride}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}\nHint: ${hint ?? 'N/A'}\nExplanation: ${explanation ?? 'N/A'}`;
    return this.callWithRetry<ValidationResult>(prompt, [], 'validateQuestion', { temperature });
  }
}
