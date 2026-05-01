import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { QuestionDropPayload } from '@trivioq/shared-types';
import { requireAuth } from '../middleware/firebase-auth';
import { DIFFICULTY_POINTS, deductUserScores, upsertUserScores } from '../utils/scoring';
import { getSettingNumber } from '../utils/settings';

const router = express.Router();

router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();

    const activeDrop = await prisma.userDrop.findFirst({
      where: { userId, isAnswered: false, expirationTime: { gt: now } },
      include: {
        question: {
          select: {
            id: true,
            categories: { select: { name: true } },
            difficultyLevel: true,
            questionText: true,
            // Choices sorted by display order; isCorrect intentionally omitted
            choices: { select: { id: true, text: true, order: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!activeDrop || !activeDrop.question) {
      return res.status(204).send({});
    }

    const pointsValue = DIFFICULTY_POINTS[activeDrop.question.difficultyLevel] ?? 10;
    const hintCostPercent = await getSettingNumber('hint_cost_percent', 30);

    const payload: QuestionDropPayload = {
      dropId: activeDrop.id,
      questionId: activeDrop.question.id,
      category: activeDrop.question.categories[0]?.name ?? 'General',
      difficulty: activeDrop.question.difficultyLevel.toLowerCase() as 'easy' | 'medium' | 'hard',
      questionText: activeDrop.question.questionText,
      options: activeDrop.question.choices.map((c) => c.text),
      expiresAt: activeDrop.expirationTime.getTime(),
      pointsValue,
      hintCost: Math.floor(pointsValue * (hintCostPercent / 100)),
      usedHint: activeDrop.usedHint,
      revealedAnswer: activeDrop.revealedAnswer,
    };

    res.json(payload);
  } catch (error) {
    console.error('Failed to fetch active drop:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:dropId/hint', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { dropId } = req.params;

    const userDrop = await prisma.userDrop.findUnique({
      where: { id: dropId },
      include: { question: { select: { hintText: true, difficultyLevel: true } } },
    });

    if (!userDrop || userDrop.userId !== userId) {
      return res.status(404).json({ error: 'Drop not found' });
    }
    if (userDrop.isAnswered) {
      return res.status(400).json({ error: 'Drop already answered' });
    }
    if (new Date() > userDrop.expirationTime) {
      return res.status(410).json({ error: 'Drop has expired' });
    }
    if (userDrop.usedHint) {
      return res.status(400).json({ error: 'Hint already used for this drop' });
    }
    if (!userDrop.question.hintText) {
      return res.status(404).json({ error: 'No hint available for this question' });
    }

    const pointsValue = DIFFICULTY_POINTS[userDrop.question.difficultyLevel] ?? 10;
    const hintCostPercent = await getSettingNumber('hint_cost_percent', 30);
    const hintCost = Math.floor(pointsValue * (hintCostPercent / 100));

    await prisma.userDrop.update({
      where: { id: dropId },
      data: { usedHint: true, hintCostDeducted: hintCost },
    });

    deductUserScores(userId, hintCost).catch((err) => console.error('[drop/hint] Failed to deduct scores:', err));

    res.json({ hintText: userDrop.question.hintText, hintCost });
  } catch (error) {
    console.error('Failed to process hint request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:dropId/reveal-answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { dropId } = req.params;

    const userDrop = await prisma.userDrop.findUnique({
      where: { id: dropId },
      include: {
        question: {
          select: {
            choices: { select: { id: true, isCorrect: true }, orderBy: { order: 'asc' } },
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
    if (new Date() > userDrop.expirationTime) {
      return res.status(410).json({ error: 'Drop has expired' });
    }

    await prisma.userDrop.update({
      where: { id: dropId },
      data: { revealedAnswer: true },
    });

    const correctOptionIndex = userDrop.question.choices.findIndex((c) => c.isCorrect);

    res.json({ correctOptionIndex, message: 'Answer revealed. No points will be awarded.' });
  } catch (error) {
    console.error('Failed to reveal answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:dropId/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { dropId } = req.params;

    const selectedOptionIndex = req.body.selectedOptionIndex ?? req.body.selectedChoiceId;

    if (selectedOptionIndex === undefined) {
      return res.status(400).json({ error: 'Missing selectedOptionIndex in payload' });
    }

    const userDrop = await prisma.userDrop.findUnique({
      where: { id: dropId },
      include: {
        question: {
          select: {
            difficultyLevel: true,
            explanationText: true,
            choices: { select: { id: true, isCorrect: true }, orderBy: { order: 'asc' } },
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
    const correctOptionIndex = question.choices.findIndex((c) => c.isCorrect);
    const isCorrect = !userDrop.revealedAnswer && selectedOptionIndex === correctOptionIndex;
    const pointsAwarded = isCorrect ? (DIFFICULTY_POINTS[question.difficultyLevel] ?? 10) : 0;

    // Resolve the selected index to the real Choice.id now that choices are a proper relation
    const selectedChoiceId = question.choices[Number(selectedOptionIndex)]?.id ?? String(selectedOptionIndex);

    const [, updatedUser] = await prisma.$transaction([
      prisma.userDrop.update({
        where: { id: dropId },
        data: {
          isAnswered: true,
          wasCorrect: isCorrect,
          selectedChoiceId,
          pointsAwarded,
          answeredAt: now,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          currentStreak: isCorrect ? { increment: 1 } : 0,
          cumulativeScore: { increment: pointsAwarded },
        },
      }),
    ]);

    const response = {
      isCorrect,
      correctOptionIndex,
      pointsAwarded,
      revealedAnswer: userDrop.revealedAnswer,
      explanation: question.explanationText || undefined,
      newStreak: updatedUser.currentStreak,
      newTotalScore: updatedUser.cumulativeScore,
    };

    if (isCorrect) {
      upsertUserScores(userId, pointsAwarded).catch((err) => console.error('[drop/submit] Failed to upsert UserScore:', err));
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to submit drop:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/on-demand', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const vaultActive = user.onDemandVaultExpires != null && user.onDemandVaultExpires > now;
    if (user.subscriptionTier === 'FREE' && !vaultActive) {
      return res.status(403).json({
        code: 'UPGRADE_REQUIRED',
        message: 'Instant drops are a Premium feature.',
      });
    }

    let dropsReceivedToday = user.dropsReceivedToday;

    const isSameDay = user.lastDropDate.getUTCFullYear() === now.getUTCFullYear() && user.lastDropDate.getUTCMonth() === now.getUTCMonth() && user.lastDropDate.getUTCDate() === now.getUTCDate();

    if (!isSameDay) dropsReceivedToday = 0;

    const premiumLimit = await getSettingNumber('max_drops_premium', 100);
    if (dropsReceivedToday >= premiumLimit) {
      return res.status(429).json({ error: `Daily drop limit reached (${premiumLimit}/day).` });
    }

    const questions = await prisma.question.findMany({
      select: {
        id: true,
        categories: { select: { name: true } },
        difficultyLevel: true,
        questionText: true,
        choices: { select: { text: true }, orderBy: { order: 'asc' } },
      },
    });

    if (questions.length === 0) {
      return res.status(500).json({ error: 'No questions available' });
    }

    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    const expirationTime = new Date(now.getTime() + 15 * 60000);

    const userDrop = await prisma.userDrop.create({
      data: {
        userId: user.id,
        questionId: randomQ.id,
        scheduledDropTime: now,
        expirationTime,
        isAnswered: false,
        scheduledFor: now,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { dropsReceivedToday: dropsReceivedToday + 1, lastDropDate: now },
    });

    const pointsValue = DIFFICULTY_POINTS[randomQ.difficultyLevel] ?? 10;
    const hintCostPercent = await getSettingNumber('hint_cost_percent', 30);

    const payload: QuestionDropPayload = {
      dropId: userDrop.id,
      questionId: randomQ.id,
      category: randomQ.categories[0]?.name ?? 'General',
      difficulty: randomQ.difficultyLevel.toLowerCase() as 'easy' | 'medium' | 'hard',
      questionText: randomQ.questionText,
      options: randomQ.choices.map((c) => c.text),
      expiresAt: expirationTime.getTime(),
      pointsValue,
      hintCost: Math.floor(pointsValue * (hintCostPercent / 100)),
      usedHint: false,
      revealedAnswer: false,
    };

    return res.json(payload);
  } catch (error) {
    console.error('Failed to create on-demand drop:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
