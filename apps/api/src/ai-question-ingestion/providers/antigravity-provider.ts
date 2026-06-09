import { spawn } from 'child_process';
import * as path from 'path';
import type { AIProvider, ClassificationResult, EnhancementResult, ExtractionResult, ImageInput } from './ai-provider';
import { ENHANCEMENT_PROMPT, EXTRACTION_PROMPT, SCOUT_PROMPT } from '../prompts';

// ── Antigravity CLI Provider ────────────────────────────────────────────────

export class AntigravityProvider implements AIProvider {
  constructor() {}

  private async callCli(prompt: string, images: ImageInput[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      // Append images formatted as data URLs to the prompt text
      let fullPrompt = prompt;
      if (images.length > 0) {
        const imagePayloads = images.map((img, index) => `\n\n[Attached Image ${index + 1} (${img.mimeType}): data:${img.mimeType};base64,${img.base64}]`).join('');
        fullPrompt += imagePayloads;
      }

      // Use the absolute path to the newly installed 'agy' CLI binary
      const cliPath = path.join(process.env.HOME || '', '.local/bin/agy');
      const child = spawn(cliPath, []);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`[AntigravityProvider] CLI exited with code ${code}: ${stderr}`));
        } else {
          resolve(this.stripMarkdownFences(stdout.trim()));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`[AntigravityProvider] Failed to start CLI: ${err.message}`));
      });

      // Write the prompt to stdin and close it
      child.stdin.write(fullPrompt);
      child.stdin.end();
    });
  }

  private stripMarkdownFences(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```json')) {
      return trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    if (trimmed.startsWith('```')) {
      return trimmed.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return trimmed;
  }

  async classifyImage(image: ImageInput): Promise<ClassificationResult> {
    const text = await this.callCli(SCOUT_PROMPT, [image]);
    try {
      return JSON.parse(text) as ClassificationResult;
    } catch (e) {
      console.error('[AntigravityProvider] classifyImage parse error:', text);
      throw e;
    }
  }

  async extractFromImages(images: ImageInput[], promptOverride?: string): Promise<ExtractionResult> {
    const prompt = promptOverride ?? EXTRACTION_PROMPT;
    const text = await this.callCli(prompt, images);
    try {
      return JSON.parse(text) as ExtractionResult;
    } catch (e) {
      console.error('[AntigravityProvider] extractFromImages parse error:', text);
      throw e;
    }
  }

  async enhanceQuestion(questionText: string, choices: unknown[], promptOverride?: string): Promise<EnhancementResult> {
    const basePrompt = promptOverride ?? ENHANCEMENT_PROMPT;
    const userMessage = `${basePrompt}\n\nQuestion: ${questionText}\nChoices: ${JSON.stringify(choices)}\n\nReturn a JSON object with: hint, explanation, aiQualityScore, difficulty`;
    const text = await this.callCli(userMessage);
    try {
      return JSON.parse(text) as EnhancementResult;
    } catch (e) {
      console.error('[AntigravityProvider] enhanceQuestion parse error:', text);
      throw e;
    }
  }
}
