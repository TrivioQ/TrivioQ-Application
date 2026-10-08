import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { requireSession } from '../middleware/firebase-auth';
import { resolvePeriod, getFriendIds, getUserPosition, LeaderboardPeriod, LeaderboardScope } from '../services/leaderboard-service';

const router = express.Router();

type ScoreRow = {
  totalScore: number;
  baseScore: number;
  bonusScore: number;
  user: { id: string; username: string; displayName: string | null; currentStreak: number };
};

// Competition ranking: tied scores share a rank (1, 2, 2, 4).
function toLeaderboard(rows: ScoreRow[]) {
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.totalScore !== rows[i - 1].totalScore) rank = i + 1;
    return {
      rank,
      id: r.user.id,
      username: r.user.username,
      displayName: r.user.displayName,
      currentStreak: r.user.currentStreak,
      cumulativeScore: r.totalScore,
      baseScore: r.baseScore,
      bonusScore: r.bonusScore,
    };
  });
}

const userSelect = { select: { id: true, username: true, displayName: true, currentStreak: true } };

// Public — returns the top 10 players for a given period from the UserScore ledger.
router.get('/global', async (req: Request, res: Response) => {
  try {
    const resolved = resolvePeriod((req.query.period as string) || 'alltime');
    if (!resolved) {
      return res.status(400).json({ error: 'Invalid period. Use weekly, monthly, or alltime.' });
    }

    const rows = await prisma.userScore.findMany({
      where: resolved,
      orderBy: { totalScore: 'desc' },
      take: 10,
      include: { user: userSelect },
    });

    res.json({ leaderboard: toLeaderboard(rows) });
  } catch (error) {
    console.error('Failed to fetch global leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/friends', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const resolved = resolvePeriod((req.query.period as string) || 'alltime');
    if (!resolved) {
      return res.status(400).json({ error: 'Invalid period.' });
    }

    const leaderboardIds = [userId, ...(await getFriendIds(userId))];

    const rows = await prisma.userScore.findMany({
      where: { ...resolved, userId: { in: leaderboardIds } },
      orderBy: { totalScore: 'desc' },
      include: { user: userSelect },
    });

    res.json({ leaderboard: toLeaderboard(rows) });
  } catch (error) {
    console.error('Failed to fetch friends leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/leaderboards/me?period=weekly|monthly|alltime&scope=global|friends
// The signed-in user's own position — used for the pinned "Your position" row
// when they are outside the visible top 10.
router.get('/me', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const period = ((req.query.period as string) || 'weekly') as LeaderboardPeriod;
    const scope = ((req.query.scope as string) || 'global') as LeaderboardScope;
    if (!resolvePeriod(period) || (scope !== 'global' && scope !== 'friends')) {
      return res.status(400).json({ error: 'Invalid period or scope.' });
    }

    res.json(await getUserPosition(userId, period, scope));
  } catch (error) {
    console.error('Failed to fetch leaderboard position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
