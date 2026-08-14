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
  protected abstract call(prompt: string, images?: ImageInput[], options?: { temperature?: number; signal?: AbortSignal }): Promise<string>;

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

  private rateLimitQueue: Promise<void> = Promise.resolve();

  protected async enforceRateLimit(minDelayMs: number): Promise<void> {
    const nextPromise = this.rateLimitQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      if (elapsed < minDelayMs) {
        await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
      }
      this.lastCallTime = Date.now();
    });
    this.rateLimitQueue = nextPromise;
    await nextPromise;
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
          console.error(`[${this.constructor.name}] FATAL: Unrecoverable error. Error: ${error.message}`);
          throw new Error(`Fatal API error (${this.constructor.name}): ${error.message}`);
        }

        if (error instanceof ApiRateLimitError) {
          if (attempt === maxRetries) {
            console.error(`[${this.constructor.name}] Max retries exhausted. HTTP ${error.status}: ${error.message}`);
            throw new Error(`Max retries exhausted (${this.constructor.name}): HTTP ${error.status}`);
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

        if (error?.name === 'AbortError' || error?.message?.includes('aborted') || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')) {
          throw error;
        }

        // Generic error (network timeout, etc.)
        if (attempt === maxRetries) {
          console.error(`[${this.constructor.name}] Max retries exhausted. Error: ${error instanceof Error ? error.message : error}`);
          throw new Error(`Max retries exhausted (${this.constructor.name}): ${error instanceof Error ? error.message : error}`);
        }
        console.warn(`[${this.constructor.name}] Error (Attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : error}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error(`[${this.constructor.name}] Unreachable code reached in retry loop`);
  }

  private async callWithRetry<T>(prompt: string, images: ImageInput[], op: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<T> {
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

  async classifyImage(image: ImageInput, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<ClassificationResult> {
    return this.callWithRetry<ClassificationResult>(promptOverride ?? SCOUT_PROMPT, [image], 'classifyImage', options);
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<ExtractionResult> {
    return this.callWithRetry<ExtractionResult>(promptOverride ?? EXTRACTION_PROMPT, images, 'extractFromImages', options);
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<EnhancementResult> {
    const prompt = `${promptOverride ?? ENHANCEMENT_PROMPT}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}`;
    return this.callWithRetry<EnhancementResult>(prompt, [], 'enhanceQuestion', options);
  }

  async summarizeImage(image: ImageInput, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<SummarizationResult> {
    return this.callWithRetry<SummarizationResult>(promptOverride ?? SUMMARIZE_IMAGE_PROMPT, [image], 'summarizeImage', options);
  }

  async extractFromText(text: string, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<ExtractionResult> {
    const prompt = `${promptOverride ?? QUIZ_GENERATION_FROM_TEXT_PROMPT}\n\n## Content to use for Generation\n\n${text}`;
    return this.callWithRetry<ExtractionResult>(prompt, [], 'extractFromText', options);
  }

  async validateQuestion(questionText: string, choices: unknown[], hint: string | null, explanation: string | null, promptOverride?: string, options?: { temperature?: number; signal?: AbortSignal }): Promise<ValidationResult> {
    const prompt = `${promptOverride}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}\nHint: ${hint ?? 'N/A'}\nExplanation: ${explanation ?? 'N/A'}`;
    return this.callWithRetry<ValidationResult>(prompt, [], 'validateQuestion', options);
  }
}
