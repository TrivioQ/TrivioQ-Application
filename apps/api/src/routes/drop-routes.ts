import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { DIFFICULTY_POINTS, upsertUserScores } from '../utils/scoring';
import { UserPreferences } from '@trivioq/shared-types';
import { startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getSettingNumber } from '../utils/settings';

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
    const effectiveDeadline = userDrop.answerDeadline ?? userDrop.expirationTime;
    if (now > effectiveDeadline) {
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

// ── POST /drops/on-demand ─────────────────────────────────────────────────────
// Lets an entitled user instantly pull a fresh question outside the scheduler.
// Entitlement: active subscription OR a valid on-demand vault.
// Rate limit: shared 50-drop daily cap (same bucket as scheduled drops).
router.post('/on-demand', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();

    // ── 1. Load user ──────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        preferences: true,
        currentStreak: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ── 2. Entitlement check ──────────────────────────────────────────────────
    const isEntitled = user.subscriptionTier === 'PREMIUM' || (user.subscriptionTier === 'PLUS' && user.subscriptionExpiresAt != null && user.subscriptionExpiresAt > now);
    if (!isEntitled) {
      return res.status(403).json({ error: 'Active subscription or on-demand vault required' });
    }

    // ── 3. Shared daily drop cap (50) ─────────────────────────────────────────
    const prefs = user.preferences as unknown as UserPreferences | null;
    const timezone: string = (prefs as any)?.timezone ?? 'UTC';

    // Convert now to the user's local timezone, then find midnight in UTC
    const localNow = toZonedTime(now, timezone);
    const localMidnight = startOfDay(localNow);
    // startOfDay returns a Date whose wall-clock values represent midnight in the
    // user's tz; convert back to UTC for the Prisma query boundary.
    const utcDayStart = new Date(localMidnight.getTime() - localMidnight.getTimezoneOffset() * 60_000);

    const dropsToday = await prisma.userDrop.count({
      where: {
        userId,
        createdAt: { gte: utcDayStart },
      },
    });

    if (dropsToday >= 50) {
      return res.status(429).json({ error: 'Daily drop limit reached' });
    }

    // ── 4. Question selection (anti-join: unseen questions only) ──────────────
    let categoryIds: string[] = [];
    if (prefs?.categoryPercentages) {
      const names = Object.keys(prefs.categoryPercentages);
      if (names.length > 0) {
        const cats = await prisma.category.findMany({
          where: { name: { in: names } },
          select: { id: true },
        });
        categoryIds = cats.map((c) => c.id);
      }
    }

    const question = await prisma.question.findFirst({
      where: {
        ...(categoryIds.length > 0 && {
          categories: { some: { id: { in: categoryIds } } },
        }),
        drops: { none: { userId, isViewed: true } },
      },
      select: {
        id: true,
        questionText: true,
        difficultyLevel: true,
        explanationText: true,
        hintText: true,
        categories: { select: { id: true, name: true } },
        choices: { select: { id: true, text: true, order: true, isCorrect: true } },
      },
    });

    if (!question) {
      return res.status(404).json({ error: 'No eligible questions available' });
    }

    // ── 5. Create the UserDrop — immediately marked as viewed ─────────────────
    const dropExpiryMinutes = await getSettingNumber('drop_expiry_minutes', 30);
    const expirationTime = new Date(now.getTime() + dropExpiryMinutes * 60_000);

    const userDrop = await prisma.userDrop.create({
      data: {
        userId,
        questionId: question.id,
        scheduledDropTime: now,
        expirationTime,
        scheduledFor: now,
        dropType: 'ON_DEMAND',
        isViewed: true,
      },
      select: { id: true },
    });

    // ── 6. Streak maintenance (first answered drop of local day increments) ───
    // "First answered question of the day" check — if none yet, bump the streak.
    const answeredToday = await prisma.userDrop.count({
      where: {
        userId,
        isAnswered: true,
        createdAt: { gte: utcDayStart },
      },
    });

    if (answeredToday === 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { currentStreak: { increment: 1 } },
      });
    }

    // ── 7. Response ───────────────────────────────────────────────────────────
    const pointsValue = DIFFICULTY_POINTS[question.difficultyLevel] ?? 10;

    return res.status(201).json({
      dropId: userDrop.id,
      questionId: question.id,
      questionText: question.questionText,
      difficultyLevel: question.difficultyLevel,
      explanationText: question.explanationText ?? null,
      hintText: question.hintText ?? null,
      categories: question.categories,
      choices: question.choices.sort((a, b) => a.order - b.order),
      expiresAt: expirationTime.getTime(),
      pointsValue,
    });
  } catch (error) {
    console.error('[drops/on-demand] Failed to serve on-demand drop:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
