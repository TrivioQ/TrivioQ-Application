/**
 * Question Validation Service
 *
 * Fetches all PENDING questions and runs each through an AI validation pass
 * covering fact-check, validity, and completeness.
 *
 * - PASS  → status: 'AI-APPROVED', aiFeedback: summary
 * - FAIL  → status: 'AI-REJECTED',  aiFeedback: summary
 *
 * Reads its AI model + delay + temperature from the `enhancement`
 * IngestionStageConfig (the same row the ingestion enhancement phase uses),
 * so admin edits in the portal flow through to the validator with no env vars.
 */

import { prisma, type IngestionStageConfig } from '@trivioq/database';
import { resolveProvider } from '../ai-question-ingestion/providers/registry';
import { buildValidationPrompt } from '../ai-question-ingestion/prompts';
import { reportError } from '../utils/error-reporter';
import type { AIProvider } from '../ai-question-ingestion/providers';

interface ValidationConfig {
  stage: IngestionStageConfig;
  callDelayMs: number;
  concurrency: number;
}

async function resolveConfig(): Promise<ValidationConfig> {
  const stage = await prisma.ingestionStageConfig.findUnique({
    where: { stage: 'enhancement' },
  });
  if (!stage || !stage.isActive) {
    throw new Error(
      '[question-validation] IngestionStageConfig "enhancement" is missing or inactive. Configure it in the admin portal.',
    );
  }
  if (!stage.modelId) {
    throw new Error(
      '[question-validation] IngestionStageConfig "enhancement" has no modelId assigned. Assign a model in the admin portal.',
    );
  }
  // Reuse the same model/delay/temperature as enhancement; concurrency defaults to 10.
  const callDelayMs = Math.max(0, stage.callDelaySec * 1000);
  const concurrency = Math.max(1, stage.concurrency ?? 10);
  return { stage, callDelayMs, concurrency };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runQuestionValidation(signal?: AbortSignal): Promise<void> {
  const { stage, callDelayMs, concurrency } = await resolveConfig();
  const provider: AIProvider = await resolveProvider(stage.modelId, signal);

  console.log(`[question-validation] Starting — model: ${stage.modelId}, delay: ${callDelayMs}ms`);

  let passed = 0;
  let failed = 0;
  let errors = 0;
  let totalProcessed = 0;
  const BATCH_SIZE = 50;

  while (true) {
    if (signal?.aborted) throw new Error('TERMINATED_BY_ADMIN');

    // Fetch PENDING questions in batches
    const questions = await prisma.pendingQuestion.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (questions.length === 0) {
      if (totalProcessed === 0) {
        console.log('[question-validation] No PENDING questions found. Exiting.');
      }
      break;
    }

    console.log(`[question-validation] Fetched batch of ${questions.length} PENDING question(s).`);

    for (let i = 0; i < questions.length; i += concurrency) {
      if (signal?.aborted) throw new Error('TERMINATED_BY_ADMIN');

      const chunk = questions.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (question) => {
          // Inter-call delay for rate limiting, only applied if non-zero
          if (totalProcessed > 0 && callDelayMs > 0) {
            await new Promise((r) => setTimeout(r, callDelayMs));
          }

          if (signal?.aborted) throw new Error('TERMINATED_BY_ADMIN');

          console.log(`[question-validation] Validating question — id: ${question.id}`);

          try {
            const choices = Array.isArray(question.suggestedChoices) ? question.suggestedChoices : [];
            const result = await provider.validateQuestion(question.suggestedText, choices, question.hint, question.explanation, buildValidationPrompt(question.ageRating), { temperature: stage.temperature, signal });

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
              const ageRatingFailed = !result.ageRating?.passed && result.ageRating?.rationale;
              const hintFailed = !result.hintQuality?.passed && result.hintQuality?.rationale;
              const explanationFailed = !result.explanationQuality?.passed && result.explanationQuality?.rationale;

              let feedback = result.summary;
              if (ageRatingFailed) feedback += ` [Age Rating: ${result.ageRating.rationale}]`;
              if (hintFailed) feedback += ` [Hint: ${result.hintQuality.rationale}]`;
              if (explanationFailed) feedback += ` [Explanation: ${result.explanationQuality.rationale}]`;

              await prisma.pendingQuestion.update({
                where: { id: question.id },
                data: {
                  status: 'AI-REJECTED',
                  aiFeedback: feedback,
                  ...(ageRatingFailed ? { ageRating: 'MATURE' } : {}),
                },
              });
              failed++;
              console.log(`[question-validation] ✗ REJECTED — id: ${question.id} | ${feedback}`);
            }
          } catch (error) {
            errors++;
            console.error(`[question-validation] Error validating question ${question.id}:`, error);
            reportError(error instanceof Error ? error : new Error(String(error)), {
              service: 'question-validation',
              questionId: question.id,
            });
          }

          totalProcessed++;
        }),
      );
    }
  }

  console.log(`[question-validation] Completed — total: ${totalProcessed}, approved: ${passed}, rejected: ${failed}, errors: ${errors}`);
}
