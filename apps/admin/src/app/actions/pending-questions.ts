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
    const where = filter === 'ai-validated' ? { isValidated: true, status: 'PENDING' } : { status: 'PENDING' };

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
      const question = await tx.question.create({
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

      // NOTE: We only update the status to 'APPROVED'. Pending questions are NEVER deleted
      // from the database, ensuring we maintain a full history/audit trail of AI generations.
      await tx.pendingQuestion.update({
        where: { id: pendingId },
        data: { status: 'APPROVED' },
      });

      return question;
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
