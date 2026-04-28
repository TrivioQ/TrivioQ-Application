import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { getWeekStart, getMonthStart, OVERALL_PERIOD_START } from '../utils/scoring';

const router = express.Router();

// Public — returns the top 10 players for a given period from the UserScore ledger.
router.get('/global', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'alltime';
    const limit = 10;

    let periodType: 'OVERALL' | 'WEEKLY' | 'MONTHLY';
    let periodStart: Date;

    if (period === 'alltime') {
      periodType = 'OVERALL';
      periodStart = OVERALL_PERIOD_START;
    } else if (period === 'weekly') {
      periodType = 'WEEKLY';
      periodStart = getWeekStart();
    } else if (period === 'monthly') {
      periodType = 'MONTHLY';
      periodStart = getMonthStart();
    } else {
      return res.status(400).json({ error: 'Invalid period. Use weekly, monthly, or alltime.' });
    }

    const rows = await prisma.userScore.findMany({
      where: { periodType, periodStart },
      orderBy: { totalScore: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, displayName: true, currentStreak: true },
        },
      },
    });

    const leaderboard = rows.map((r) => ({
      id: r.user.id,
      username: r.user.username,
      displayName: r.user.displayName,
      currentStreak: r.user.currentStreak,
      cumulativeScore: r.totalScore,
      baseScore: r.baseScore,
      bonusScore: r.bonusScore,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Failed to fetch global leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/friends', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const period = (req.query.period as string) || 'alltime';

    let periodType: 'OVERALL' | 'WEEKLY' | 'MONTHLY';
    let periodStart: Date;

    if (period === 'alltime') {
      periodType = 'OVERALL';
      periodStart = OVERALL_PERIOD_START;
    } else if (period === 'weekly') {
      periodType = 'WEEKLY';
      periodStart = getWeekStart();
    } else if (period === 'monthly') {
      periodType = 'MONTHLY';
      periodStart = getMonthStart();
    } else {
      return res.status(400).json({ error: 'Invalid period.' });
    }

    // Find all accepted friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });

    const friendIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
    const leaderboardIds = [userId, ...friendIds];

    // Fetch scores for these users for the specific period
    const rows = await prisma.userScore.findMany({
      where: {
        userId: { in: leaderboardIds },
        periodType,
        periodStart,
      },
      orderBy: { totalScore: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, currentStreak: true },
        },
      },
    });

    const leaderboard = rows.map((r) => ({
      id: r.user.id,
      username: r.user.username,
      displayName: r.user.displayName,
      currentStreak: r.user.currentStreak,
      cumulativeScore: r.totalScore,
      baseScore: r.baseScore,
      bonusScore: r.bonusScore,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Failed to fetch friends leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
