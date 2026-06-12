'use server';

import { PrismaClient, DifficultyLevel } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────────

export interface EditQuestionPayload {
  questionText: string;
  difficultyLevel: DifficultyLevel;
  categorySlugs: string[];
  choices: { text: string; order: number; isCorrect: boolean }[];
  hintText?: string;
  explanationText?: string;
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
      },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to update pending question:', error);
    return { success: false, error: 'Failed to update pending question' };
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────────

export async function getPendingQuestions(filter?: string) {
  try {
    let where: Record<string, unknown>;
    if (filter === 'ai-validated') {
      where = { isValidated: true, status: 'PENDING' };
    } else if (filter === 'pending-duplicate') {
      where = { status: 'PENDING-DUPLICATE' };
    } else {
      where = { status: 'PENDING' };
    }

    const questions = await prisma.pendingQuestion.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: questions };
  } catch (error) {
    console.error('Failed to fetch pending questions:', error);
    return { success: false, error: 'Failed to fetch pending questions' };
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

      let questionId: string;

      if (pendingQuestion.status === 'PENDING-DUPLICATE' && pendingQuestion.replacesQuestionId) {
        // ── Case B: Update the existing live question in-place ───────────────────
        const liveId = pendingQuestion.replacesQuestionId;

        // Replace choices: delete old ones then create new
        await tx.choice.deleteMany({ where: { questionId: liveId } });

        const updated = await tx.question.update({
          where: { id: liveId },
          data: {
            questionText: editedData.questionText,
            difficultyLevel: editedData.difficultyLevel,
            hintText: editedData.hintText ?? null,
            explanationText: editedData.explanationText ?? null,
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
    return { success: false, error: 'Failed to approve pending question' };
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
    return { success: false, error: 'Failed to reject pending question' };
  }
}
