/**
 * Question Validation Service
 *
 * Fetches all PENDING questions and runs each through an AI validation pass
 * covering fact-check, validity, and completeness.
 *
 * - PASS  → status: 'AI-APPROVED', aiFeedback: summary
 * - FAIL  → status: 'AI-REJECTED',  aiFeedback: summary
 *
 * Uses the same provider / model / delay / temperature env vars as the
 * ingestion enhancement phase:
 *   INGESTION_ENHANCEMENT_PROVIDER  (default: 'google')
 *   INGESTION_ENHANCEMENT_MODEL
 *   INGESTION_ENHANCEMENT_CALL_DELAY_SEC  (default: 3)
 *   INGESTION_ENHANCEMENT_TEMPERATURE     (default: 0.7)
 */

import { prisma } from '@trivioq/database';
import { createProvider, type AIProviderName } from '../ai-question-ingestion/providers';
import { buildValidationPrompt, type ValidationResult } from '../ai-question-ingestion/prompts';
import { reportError } from '../utils/error-reporter';

// ── Config ────────────────────────────────────────────────────────────────────

function resolveConfig() {
  const providerName = (process.env.INGESTION_ENHANCEMENT_PROVIDER ?? 'google') as AIProviderName;
  const model = process.env.INGESTION_ENHANCEMENT_MODEL;
  const callDelayMs = Math.max(0, parseFloat(process.env.INGESTION_ENHANCEMENT_CALL_DELAY_SEC ?? '3') * 1000);
  return { providerName, model, callDelayMs };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runQuestionValidation(): Promise<void> {
  const { providerName, model, callDelayMs } = resolveConfig();
  const provider = createProvider(providerName, model);

  console.log(`[question-validation] Starting — provider: ${providerName}, model: ${model ?? 'default'}, delay: ${callDelayMs}ms`);

  // Fetch all PENDING questions
  const questions = await prisma.pendingQuestion.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  if (questions.length === 0) {
    console.log('[question-validation] No PENDING questions found. Exiting.');
    return;
  }

  console.log(`[question-validation] Found ${questions.length} PENDING question(s) to validate.`);

  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Inter-call delay (skip before the first call)
    if (i > 0 && callDelayMs > 0) {
      await new Promise((r) => setTimeout(r, callDelayMs));
    }

    console.log(`[question-validation] Validating question ${i + 1}/${questions.length} — id: ${question.id}`);

    try {
      // Parse the stored choices JSON into an array
      const choices = Array.isArray(question.suggestedChoices) ? question.suggestedChoices : [];

      // Call the AI provider. enhanceQuestion() accepts a promptOverride and appends
      // the question + choices automatically. We cast the raw JSON response to
      // ValidationResult because the prompt instructs a different schema.
      const rawResult = await provider.enhanceQuestion(question.suggestedText, choices, buildValidationPrompt(question.ageRating));
      const result = rawResult as unknown as ValidationResult;

      if (result.overallPassed) {
        await prisma.pendingQuestion.update({
          where: { id: question.id },
          data: {
            status: 'AI-APPROVED',
            aiFeedback: result.summary,
          },
        });
        passed++;
        console.log(`[question-validation] ✓ APPROVED — id: ${question.id} | ${result.summary}`);
      } else {
        await prisma.pendingQuestion.update({
          where: { id: question.id },
          data: {
            status: 'AI-REJECTED',
            aiFeedback: result.summary,
          },
        });
        failed++;
        console.log(`[question-validation] ✗ REJECTED — id: ${question.id} | ${result.summary}`);
      }
    } catch (error) {
      errors++;
      console.error(`[question-validation] Error validating question ${question.id}:`, error);
      reportError(error instanceof Error ? error : new Error(String(error)), {
        service: 'question-validation',
        questionId: question.id,
      });
      // Continue with the next question — don't abort the whole batch
    }
  }

  console.log(`[question-validation] Completed — total: ${questions.length}, approved: ${passed}, rejected: ${failed}, errors: ${errors}`);
}
