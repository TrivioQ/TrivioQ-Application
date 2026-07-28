'use server';

import { PrismaClient, DifficultyLevel, PendingQuestion, AgeRating } from '@trivioq/database';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────────

export interface EditQuestionPayload {
  questionText: string;
  difficultyLevel: DifficultyLevel;
  categorySlugs: string[];
  choices: { text: string; order: number; isCorrect: boolean }[];
  hintText?: string;
  explanationText?: string;
  ageRating: AgeRating;
}

// ── Update (save edits without approving) ────────────────────────────────────────

export async function updatePendingQuestion(pendingId: string, editedData: EditQuestionPayload) {
  try {
    await prisma.pendingQuestion.update({
      where: { id: pendingId },
      data: {
        suggestedText: editedData.questionText,
        difficultyLevel: editedData.difficultyLevel,
        categorySlugs: editedData.categorySlugs,
        suggestedChoices: editedData.choices,
        hint: editedData.hintText ?? null,
        explanation: editedData.explanationText ?? null,
        ageRating: editedData.ageRating,
      },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to update pending question:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to update pending question: ${message}` };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────────

export interface PaginatedPendingQuestionsResult {
  data: PendingQuestionWithMeta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts?: {
    unvalidated: number;
    aiValidated: number;
    aiRejected: number;
    pendingDuplicate: number;
    rejected: number;
  };
}

export interface PendingQuestionWithMeta extends Omit<PendingQuestion, 'createdAt' | 'updatedAt'> {
  id: string;
  topic: string;
  categorySlugs: string[];
  difficultyLevel: DifficultyLevel;
  suggestedText: string;
  suggestedChoices: any;
  hint: string | null;
  explanation: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  aiQualityScore: number | null;
  aiFeedback: string | null;
  isDuplicate: boolean;
  replacesQuestionId: string | null;
  ageRating: AgeRating;
}

export interface PendingQuestionsFilters {
  filter?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  difficulties?: DifficultyLevel[];
  ageRatings?: AgeRating[];
  categorySlugs?: string[];
  scores?: string[];
}

const PAGE_SIZE = 25;

// ── Fetch ────────────────────────────────────────────────────────────────────────

export async function getPendingQuestions(filters?: PendingQuestionsFilters): Promise<{ success: boolean; data?: PendingQuestionWithMeta[]; error?: string } | PaginatedPendingQuestionsResult> {
  try {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? PAGE_SIZE;
    const filter = filters?.filter;

    const baseWhere: any = {};
    const andConditions: any[] = [];

    if (filters?.search) {
      andConditions.push({
        OR: [
          { suggestedText: { contains: filters.search, mode: 'insensitive' } },
          { topic: { contains: filters.search, mode: 'insensitive' } },
        ]
      });
    }

    if (filters?.scores && filters.scores.length > 0) {
       const scoreConditions = [];
       if (filters.scores.includes('high')) scoreConditions.push({ aiQualityScore: { gt: 80 } });
       if (filters.scores.includes('medium')) scoreConditions.push({ aiQualityScore: { gte: 50, lte: 80 } });
       if (filters.scores.includes('low')) scoreConditions.push({ aiQualityScore: { lt: 50 } });
       if (scoreConditions.length > 0) {
          andConditions.push({ OR: scoreConditions });
       }
    }

    if (andConditions.length > 0) {
       baseWhere.AND = andConditions;
    }
    
    if (filters?.difficulties && filters.difficulties.length > 0) {
      baseWhere.difficultyLevel = { in: filters.difficulties };
    }
    
    if (filters?.ageRatings && filters.ageRatings.length > 0) {
      baseWhere.ageRating = { in: filters.ageRatings };
    }
    
    if (filters?.categorySlugs && filters.categorySlugs.length > 0) {
      baseWhere.categorySlugs = { hasSome: filters.categorySlugs };
    }

    const where: any = { ...baseWhere };
    if (filter === 'ai-validated') {
      where.status = 'AI-APPROVED';
    } else if (filter === 'ai-rejected') {
      where.status = 'AI-REJECTED';
    } else if (filter === 'pending-duplicate') {
      where.status = 'PENDING-DUPLICATE';
    } else if (filter === 'rejected') {
      where.status = 'REJECTED';
    } else {
      where.status = 'PENDING';
    }

    const [questions, total, statusCounts] = await Promise.all([
      prisma.pendingQuestion.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pendingQuestion.count({ where }),
      prisma.pendingQuestion.groupBy({
        by: ['status'],
        _count: true,
        where: baseWhere,
      }),
    ]);

    const counts = {
      unvalidated: 0,
      aiValidated: 0,
      aiRejected: 0,
      pendingDuplicate: 0,
      rejected: 0,
    };

    statusCounts.forEach((item) => {
      if (item.status === 'PENDING') counts.unvalidated = item._count;
      else if (item.status === 'AI-APPROVED') counts.aiValidated = item._count;
      else if (item.status === 'AI-REJECTED') counts.aiRejected = item._count;
      else if (item.status === 'PENDING-DUPLICATE') counts.pendingDuplicate = item._count;
      else if (item.status === 'REJECTED') counts.rejected = item._count;
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: questions,
      total,
      page,
      pageSize,
      totalPages,
      counts,
    };
  } catch (error) {
    console.error('Failed to fetch pending questions:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to fetch pending questions: ${message}` };
  }
}

// ── Approve ──────────────────────────────────────────────────────────────────────

export async function approvePendingQuestion(pendingId: string, editedData: EditQuestionPayload) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch the pending question to check whether this is a PENDING-DUPLICATE
      const pendingQuestion = await tx.pendingQuestion.findUniqueOrThrow({
        where: { id: pendingId },
        select: { status: true, replacesQuestionId: true },
      });

      // Dynamically check for a >95% live duplicate using the edited text
      const liveDuplicates = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Question"
        WHERE similarity("questionText", ${editedData.questionText}) > 0.95
        ORDER BY similarity("questionText", ${editedData.questionText}) DESC
        LIMIT 1
      `;

      let liveId: string | null = null;
      if (liveDuplicates.length > 0) {
        liveId = liveDuplicates[0].id;
      } else if (pendingQuestion.status === 'PENDING-DUPLICATE' && pendingQuestion.replacesQuestionId) {
        liveId = pendingQuestion.replacesQuestionId;
      }

      let questionId: string;

      if (liveId) {
        // ── Case B: Update the existing live question in-place ───────────────────
        // Replace choices: delete old ones then create new
        await tx.choice.deleteMany({ where: { questionId: liveId } });

        const updated = await tx.question.update({
          where: { id: liveId },
          data: {
            questionText: editedData.questionText,
            difficultyLevel: editedData.difficultyLevel,
            hintText: editedData.hintText ?? null,
            explanationText: editedData.explanationText ?? null,
            ageRating: editedData.ageRating,
            choices: {
              create: editedData.choices.map((c, idx) => ({
                text: c.text,
                order: c.order ?? idx,
                isCorrect: c.isCorrect,
              })),
            },
            // Replace all categories
            categories: {
              set: editedData.categorySlugs.map((slug) => ({ slug })),
            },
          },
        });

        questionId = updated.id;
      } else {
        // ── Default: Create a brand-new live Question ────────────────────────────
        const created = await tx.question.create({
          data: {
            questionText: editedData.questionText,
            difficultyLevel: editedData.difficultyLevel,
            hintText: editedData.hintText,
            explanationText: editedData.explanationText,
            ageRating: editedData.ageRating,
            choices: {
              create: editedData.choices.map((c, idx) => ({
                text: c.text,
                order: c.order ?? idx,
                isCorrect: c.isCorrect,
              })),
            },
            categories: {
              connect: editedData.categorySlugs.map((slug) => ({ slug })),
            },
          },
        });

        questionId = created.id;
      }

      // NOTE: We only update the status to 'APPROVED'. Pending questions are NEVER deleted
      // from the database, ensuring we maintain a full history/audit trail of AI generations.
      await tx.pendingQuestion.update({
        where: { id: pendingId },
        data: { status: 'APPROVED' },
      });

      return { id: questionId };
    });

    revalidatePath('/');
    revalidatePath('/questions');
    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error('Failed to approve pending question:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to approve pending question: ${message}` };
  }
}

// ── Reject ───────────────────────────────────────────────────────────────────────

export async function rejectPendingQuestion(pendingId: string, reason?: string) {
  try {
    // NOTE: We only update the status to 'REJECTED'. Pending questions are NEVER deleted
    // from the database, ensuring we maintain a full history/audit trail of AI generations.
    await prisma.pendingQuestion.update({
      where: { id: pendingId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason ?? null,
      },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to reject pending question:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to reject pending question: ${message}` };
  }
}

// ── Re-queue (AI-Rejected → PENDING) ─────────────────────────────────────────────

/**
 * Resets an AI-REJECTED question back to PENDING so it is picked up
 * by the next nightly validation cron run.
 * Clears aiFeedback so the next run produces a fresh result.
 */
export async function requeuePendingQuestion(pendingId: string) {
  try {
    await prisma.pendingQuestion.update({
      where: { id: pendingId },
      data: {
        status: 'PENDING',
        aiFeedback: null,
      },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to re-queue pending question:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to re-queue pending question: ${message}` };
  }
}

// ── Bulk Actions ─────────────────────────────────────────────────────────────────

export async function bulkRejectPendingQuestions(pendingIds: string[], reason?: string) {
  try {
    await prisma.pendingQuestion.updateMany({
      where: { id: { in: pendingIds } },
      data: {
        status: 'REJECTED',
        rejectionReason: reason ?? null,
      },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to bulk reject pending questions:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to bulk reject pending questions: ${message}` };
  }
}

export async function bulkApprovePendingQuestions(pendingIds: string[]) {
  try {
    const results = await prisma.$transaction(async (tx) => {
      const pendingQuestions = await tx.pendingQuestion.findMany({
        where: { id: { in: pendingIds } },
      });

      const processedIds: string[] = [];

      for (const pendingQuestion of pendingQuestions) {
        let questionId: string;
        
        // Parse the choices stored as JSON
        const choices = (pendingQuestion.suggestedChoices as any[]) || [];

        if (pendingQuestion.status === 'PENDING-DUPLICATE' && pendingQuestion.replacesQuestionId) {
          const liveId = pendingQuestion.replacesQuestionId;
          await tx.choice.deleteMany({ where: { questionId: liveId } });
          const updated = await tx.question.update({
            where: { id: liveId },
            data: {
              questionText: pendingQuestion.suggestedText,
              difficultyLevel: pendingQuestion.difficultyLevel,
              hintText: pendingQuestion.hint ?? null,
              explanationText: pendingQuestion.explanation ?? null,
              ageRating: pendingQuestion.ageRating,
              choices: {
                create: choices.map((c: any, idx: number) => ({
                  text: String(c.text ?? ''),
                  order: typeof c.order === 'number' ? c.order : idx,
                  isCorrect: Boolean(c.isCorrect),
                })),
              },
              categories: {
                set: pendingQuestion.categorySlugs.map((slug) => ({ slug })),
              },
            },
          });
          questionId = updated.id;
        } else {
          const created = await tx.question.create({
            data: {
              questionText: pendingQuestion.suggestedText,
              difficultyLevel: pendingQuestion.difficultyLevel,
              hintText: pendingQuestion.hint,
              explanationText: pendingQuestion.explanation,
              ageRating: pendingQuestion.ageRating,
              choices: {
                create: choices.map((c: any, idx: number) => ({
                  text: String(c.text ?? ''),
                  order: typeof c.order === 'number' ? c.order : idx,
                  isCorrect: Boolean(c.isCorrect),
                })),
              },
              categories: {
                connect: pendingQuestion.categorySlugs.map((slug) => ({ slug })),
              },
            },
          });
          questionId = created.id;
        }

        await tx.pendingQuestion.update({
          where: { id: pendingQuestion.id },
          data: { status: 'APPROVED' },
        });

        processedIds.push(questionId);
      }
      return processedIds;
    });

    revalidatePath('/');
    revalidatePath('/questions');
    return { success: true, count: results.length };
  } catch (error) {
    console.error('Failed to bulk approve pending questions:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to bulk approve pending questions: ${message}` };
  }
}
