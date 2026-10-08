import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';
import { requireSession } from '../middleware/firebase-auth';
import { getSettingNumber } from '../utils/settings';
import { getNextScheduledDropAt } from '../services/drop-orchestrator';

const router = express.Router();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const percentagesSumTo = (target: number, tolerance: number) => (data: Record<string, number>) => Math.abs(Object.values(data).reduce((acc, val) => acc + val, 0) - target) < tolerance;

// Every field is optional: clients send only what they edit, and the handler
// merges into the stored blob so one client (or screen) can't wipe fields owned
// by another — e.g. saving the theme no longer resets category selections.
const UserPreferencesSchema = z
  .object({
    displayName: z.string().min(2).max(50),
    theme: z.enum(['light', 'dark', 'system']),
    notificationsEnabled: z.boolean(),
    language: z.string(),
    categoryPercentages: z.record(z.string(), z.number()).refine(percentagesSumTo(1.0, 0.001), { message: 'Category percentages must add up to 1.0' }),
    difficultyPercentages: z.record(z.string(), z.number()).refine(percentagesSumTo(100, 0.1), { message: 'Difficulty percentages must add up to 100' }),
    // Accepted from the client to populate the User DateTime columns, but NOT
    // stored in the preferences JSON blob (authoritative source is the DB columns).
    activeWindowStart: z.string().regex(timeRegex, 'Invalid 24h time format'),
    activeWindowEnd: z.string().regex(timeRegex, 'Invalid 24h time format'),
    targetDropsPerWeek: z.number().min(1).max(100),
  })
  .partial()
  .refine((d) => (d.activeWindowStart === undefined) === (d.activeWindowEnd === undefined), { message: 'activeWindowStart and activeWindowEnd must be sent together' });

// The window is a UTC time-of-day; build it explicitly in UTC so the stored
// value doesn't depend on the server's TZ setting.
function hhmmToToday(hhmm: string, now: Date): Date {
  const [hour, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, min));
}

router.put('/preferences', requireSession, async (req: Request, res: Response) => {
  try {
    const raw = UserPreferencesSchema.parse(req.body);
    const userId = (req as any).userId;

    // Strip the window fields before writing to the JSON blob — the DB columns
    // are the authoritative source; storing them twice causes drift.
    const { activeWindowStart, activeWindowEnd, ...incoming } = raw;

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    const merged = { ...((existing.preferences as Record<string, unknown> | null) ?? {}), ...incoming } as UserPreferences;

    const now = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(activeWindowStart && activeWindowEnd ? { activeWindowStart: hhmmToToday(activeWindowStart, now), activeWindowEnd: hhmmToToday(activeWindowEnd, now) } : {}),
        ...(incoming.displayName ? { displayName: incoming.displayName } : {}),
        preferences: merged as any,
      },
    });

    res.json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to update preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /v1/users/device-token — registers the mobile device's native push token
// (FCM on Android, APNs on iOS) used by the notification worker.
router.put('/device-token', requireSession, async (req: Request, res: Response) => {
  try {
    const parsed = z.object({ devicePushToken: z.string().min(1).max(4096).nullable() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    }
    await prisma.user.update({ where: { id: (req as any).userId }, data: { devicePushToken: parsed.data.devicePushToken } });
    res.json({ message: 'Device token updated' });
  } catch (error) {
    console.error('Failed to update device token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        dateOfBirth: true,
        role: true,
        currentStreak: true,
        cumulativeScore: true,
        subscriptionTier: true,
        preferences: true,
        // Returned as ISO strings; clients convert to HH:MM for display
        activeWindowStart: true,
        activeWindowEnd: true,
        onboardingComplete: true,
        subscriptionExpiresAt: true,
        questionsAnswered: true,
        correctAnswers: true,
      } as any,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/me/score-history?period=weekly|monthly
// Returns the last 12 months of score periods for the authenticated user.
router.get('/me/score-history', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const period = (req.query.period as string) || 'weekly';

    if (period !== 'weekly' && period !== 'monthly') {
      return res.status(400).json({ error: 'Invalid period. Use weekly or monthly.' });
    }

    const periodType = period === 'weekly' ? 'WEEKLY' : 'MONTHLY';
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const scores = await prisma.userScore.findMany({
      where: {
        userId,
        periodType,
        periodStart: { gte: twelveMonthsAgo },
      },
      orderBy: { periodStart: 'desc' },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        baseScore: true,
        bonusScore: true,
        totalScore: true,
        rank: true,
      },
    });

    res.json({ history: scores });
  } catch (error) {
    console.error('Failed to fetch score history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const DROP_HISTORY_SELECT = {
  id: true,
  wasCorrect: true,
  pointsAwarded: true,
  usedHint: true,
  hintCostDeducted: true,
  revealedAnswer: true,
  selectedChoiceId: true,
  answeredAt: true,
  question: {
    select: {
      id: true,
      questionText: true,
      difficultyLevel: true,
      explanationText: true,
      categories: { select: { name: true } },
      choices: {
        select: { id: true, text: true, order: true, isCorrect: true },
        orderBy: { order: 'asc' as const },
      },
    },
  },
};

// GET /v1/users/me/recent-drops?limit=10&cursor=<dropId>&result=correct|incorrect|revealed&category=<name>
// Returns answered drops, newest first. `nextCursor` is set when more pages exist.
router.get('/me/recent-drops', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = req.query.result as string | undefined;
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;

    const resultFilter = result === 'correct' ? { wasCorrect: true } : result === 'incorrect' ? { wasCorrect: false, revealedAnswer: false } : result === 'revealed' ? { revealedAnswer: true } : {};

    const drops = await prisma.userDrop.findMany({
      where: {
        userId,
        isAnswered: true,
        ...resultFilter,
        ...(category ? { question: { categories: { some: { name: category } } } } : {}),
      },
      orderBy: [{ answeredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: DROP_HISTORY_SELECT,
    });

    const hasMore = drops.length > limit;
    const page = hasMore ? drops.slice(0, limit) : drops;
    res.json({ drops: page, nextCursor: hasMore ? page[page.length - 1].id : null });
  } catch (error) {
    console.error('Failed to fetch recent drops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/me/today — daily progress for the home screen ring, the
// "streak at risk" state and the useful empty state.
router.get('/me/today', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, subscriptionTier: true, activeWindowStart: true, activeWindowEnd: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [answeredToday, receivedToday, lastAnswered, freeLimit, premiumLimit, nextDropAt] = await Promise.all([
      prisma.userDrop.count({ where: { userId, isAnswered: true, answeredAt: { gte: todayStart } } }),
      prisma.userDrop.count({ where: { userId, createdAt: { gte: todayStart } } }),
      prisma.userDrop.findFirst({
        where: { userId, isAnswered: true },
        orderBy: { answeredAt: 'desc' },
        select: { wasCorrect: true, revealedAnswer: true, pointsAwarded: true, answeredAt: true, question: { select: { categories: { select: { name: true }, take: 1 } } } },
      }),
      getSettingNumber('max_drops_free', 7),
      getSettingNumber('max_drops_premium', 100),
      getNextScheduledDropAt(userId).catch(() => null),
    ]);

    // Window columns carry a time-of-day (UTC); project it onto today.
    const atToday = (d: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));

    res.json({
      answeredToday,
      receivedToday,
      dailyLimit: user.subscriptionTier === 'PREMIUM' ? premiumLimit : freeLimit,
      nextDropAt: nextDropAt?.toISOString() ?? null,
      windowStart: atToday(user.activeWindowStart).toISOString(),
      windowEnd: atToday(user.activeWindowEnd).toISOString(),
      currentStreak: user.currentStreak,
      streakAtRisk: user.currentStreak > 0 && answeredToday === 0,
      lastResult: lastAnswered
        ? {
            wasCorrect: lastAnswered.wasCorrect,
            revealedAnswer: lastAnswered.revealedAnswer,
            pointsAwarded: lastAnswered.pointsAwarded,
            answeredAt: lastAnswered.answeredAt,
            category: lastAnswered.question.categories[0]?.name ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to fetch today progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/me/mistakes?limit=20 — questions the user answered incorrectly
// (or gave up on), for the no-points "Review mistakes" mode. The correct answer
// is NOT included; it is only returned by the practice endpoint.
router.get('/me/mistakes', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    const drops = await prisma.userDrop.findMany({
      where: { userId, isAnswered: true, wasCorrect: false },
      orderBy: { answeredAt: 'desc' },
      distinct: ['questionId'],
      take: limit,
      select: {
        question: {
          select: {
            id: true,
            questionText: true,
            difficultyLevel: true,
            categories: { select: { name: true }, take: 1 },
            choices: { select: { id: true, text: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    res.json({
      questions: drops.map(({ question: q }) => ({
        questionId: q.id,
        questionText: q.questionText,
        difficulty: q.difficultyLevel.toLowerCase(),
        category: q.categories[0]?.name ?? 'General',
        options: q.choices,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch mistakes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /v1/users/me/practice/:questionId { selectedOptionIndex }
// Checks an answer in review mode. Awards no points and changes no stats.
// Only questions the user has already answered can be practised, so this can't
// be used to peek at upcoming drops.
router.post('/me/practice/:questionId', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { questionId } = req.params;
    const parsed = z.object({ selectedOptionIndex: z.number().int().min(0) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    }

    const answered = await prisma.userDrop.findFirst({ where: { userId, questionId, isAnswered: true }, select: { id: true } });
    if (!answered) {
      return res.status(404).json({ error: 'Question not found in your history' });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { explanationText: true, choices: { select: { isCorrect: true }, orderBy: { order: 'asc' } } },
    });
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const correctOptionIndex = question.choices.findIndex((c) => c.isCorrect);
    res.json({
      isCorrect: parsed.data.selectedOptionIndex === correctOptionIndex,
      correctOptionIndex,
      explanation: question.explanationText || undefined,
    });
  } catch (error) {
    console.error('Failed to check practice answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/search?q=<text> — find players to add as friends by username or
// display name. Returns at most 10 matches with the current relationship status.
router.get('/search', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const q = String(req.query.q ?? '')
      .trim()
      .replace(/^@/, '');
    if (q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        role: 'USER',
        accountStatus: 'ACTIVE',
        OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }],
      },
      orderBy: { username: 'asc' },
      take: 10,
      select: { id: true, username: true, displayName: true, profilePicture: true },
    });

    const ids = users.map((u) => u.id);
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: { in: ids } },
          { addresseeId: userId, requesterId: { in: ids } },
        ],
      },
      select: { requesterId: true, addresseeId: true, status: true },
    });

    const statusFor = (otherId: string) => {
      const f = friendships.find((x) => x.requesterId === otherId || x.addresseeId === otherId);
      if (!f) return 'NONE';
      if (f.status === 'PENDING') return f.requesterId === userId ? 'OUTGOING' : 'INCOMING';
      return f.status;
    };

    // Hide anyone involved in a block in either direction.
    res.json({ users: users.map((u) => ({ ...u, relationship: statusFor(u.id) })).filter((u) => u.relationship !== 'BLOCKED') });
  } catch (error) {
    console.error('Failed to search users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
