import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { DIFFICULTY_POINTS, upsertUserScores } from '../utils/scoring';

const router = express.Router();

// ── PATCH /drops/:id/view ─────────────────────────────────────────────────────
// Called by the mobile client the moment a drop card is rendered on screen.
// Marks the drop as seen so the spaced-repetition engine can track it.
router.patch('/:id/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const userDrop = await prisma.userDrop.findUnique({
      where: { id },
      select: { id: true, userId: true, isViewed: true },
    });

    if (!userDrop || userDrop.userId !== userId) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    if (!userDrop.isViewed) {
      await prisma.userDrop.update({
        where: { id },
        data: { isViewed: true },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[drops/view] Failed to mark drop as viewed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /drops/:id/answer ───────────────────────────────────────────────────
// Called when the user submits their answer from the mobile client.
// Evaluates correctness, updates the drop record, and runs the user-stats
// transaction (questionsAnswered, correctAnswers, currentStreak, score).

const AnswerBodySchema = z.object({
  selectedChoice: z.string().min(1),
});

router.patch('/:id/answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const parsed = AnswerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Missing or invalid selectedChoice', details: parsed.error.format() });
    }
    const { selectedChoice } = parsed.data;

    // Fetch drop with its question so we can evaluate in a single round-trip
    const userDrop = await prisma.userDrop.findUnique({
      where: { id },
      include: {
        question: {
          select: {
            difficultyLevel: true,
            explanationText: true,
            choices: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    if (!userDrop || userDrop.userId !== userId) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    if (userDrop.isAnswered) {
      return res.status(400).json({ error: 'Drop already answered' });
    }

    const now = new Date();
    if (now > userDrop.expirationTime) {
      return res.status(410).json({ error: 'Drop has expired' });
    }

    const { question } = userDrop;
    const correctChoice = question.choices.find((c) => c.isCorrect);
    const isCorrect = !!correctChoice && selectedChoice === correctChoice.id;
    const pointsAwarded = isCorrect ? (DIFFICULTY_POINTS[question.difficultyLevel] ?? 10) : 0;

    // ── Prisma transaction: update drop + user stats atomically ───────────────
    const [, updatedUser] = await prisma.$transaction([
      prisma.userDrop.update({
        where: { id },
        data: {
          isAnswered: true,
          wasCorrect: isCorrect,
          selectedChoiceId: selectedChoice,
          pointsAwarded,
          answeredAt: now,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          questionsAnswered: { increment: 1 },
          ...(isCorrect && { correctAnswers: { increment: 1 } }),
          // Streak: increment on correct answer, reset to 0 on wrong
          currentStreak: isCorrect ? { increment: 1 } : 0,
          cumulativeScore: { increment: pointsAwarded },
        },
      }),
    ]);

    // Update period-based score ledger outside the transaction — failure here
    // is non-fatal; the core answer has already been committed.
    if (isCorrect) {
      upsertUserScores(userId, pointsAwarded).catch((err) => console.error('[drops/answer] Failed to upsert UserScore ledger:', err));
    }

    return res.status(200).json({
      isCorrect,
      pointsAwarded,
      explanation: question.explanationText ?? null,
      newStreak: updatedUser.currentStreak,
      newTotalScore: updatedUser.cumulativeScore,
      questionsAnswered: updatedUser.questionsAnswered,
      correctAnswers: updatedUser.correctAnswers,
    });
  } catch (error) {
    console.error('[drops/answer] Failed to process answer:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
