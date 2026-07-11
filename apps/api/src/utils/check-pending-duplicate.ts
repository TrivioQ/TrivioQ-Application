import { prisma } from '@trivioq/database';

export interface PendingDuplicateResult {
  found: boolean;
  record?: {
    id: string;
    status: string;
    aiQualityScore: number | null;
    replacesQuestionId: string | null;
  };
}

/**
 * Checks the PendingQuestion table for a text-similar question (pg_trgm similarity > 0.85).
 * When multiple matches exist, returns the one with the **lowest** aiQualityScore (oldest as
 * tiebreaker) — i.e. the weakest existing candidate that should be replaced.
 */
export async function checkPendingDuplicate(suggestedText: string): Promise<PendingDuplicateResult> {
  const rows = await prisma.$queryRaw<{ id: string; status: string; ai_quality_score: number | null; replaces_question_id: string | null; similarity: number }[]>`
    SELECT
      id,
      status,
      "aiQualityScore"    AS ai_quality_score,
      "replacesQuestionId" AS replaces_question_id,
      similarity("suggestedText", ${suggestedText}) AS similarity
    FROM "PendingQuestion"
    WHERE
      status NOT IN ('APPROVED', 'REJECTED', 'AI-APPROVED', 'AI-REJECTED')
      AND similarity("suggestedText", ${suggestedText}) > 0.85
    ORDER BY
      "aiQualityScore" ASC NULLS FIRST,
      "createdAt" ASC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { found: false };
  }

  const row = rows[0];
  return {
    found: true,
    record: {
      id: row.id,
      status: row.status,
      aiQualityScore: row.ai_quality_score,
      replacesQuestionId: row.replaces_question_id,
    },
  };
}
