import { prisma } from '@trivioq/database';

export async function checkIsDuplicate(suggestedText: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ similarity: number }[]>`
    SELECT similarity("questionText", ${suggestedText}) AS similarity
    FROM "Question"
    WHERE similarity("questionText", ${suggestedText}) > 0.85
    LIMIT 1
  `;

  return rows.length > 0;
}
