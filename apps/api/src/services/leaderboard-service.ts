import { prisma } from '@trivioq/database';
import { getWeekStart, getMonthStart, OVERALL_PERIOD_START } from '../utils/scoring';
import { notificationService } from './notification-service';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';
export type LeaderboardScope = 'global' | 'friends';

export function resolvePeriod(period: string): { periodType: 'OVERALL' | 'WEEKLY' | 'MONTHLY'; periodStart: Date } | null {
  if (period === 'alltime') return { periodType: 'OVERALL', periodStart: OVERALL_PERIOD_START };
  if (period === 'weekly') return { periodType: 'WEEKLY', periodStart: getWeekStart() };
  if (period === 'monthly') return { periodType: 'MONTHLY', periodStart: getMonthStart() };
  return null;
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}

/**
 * Competition-style rank (1 + number of players strictly ahead), so tied
 * players share a rank. `rank` is null when the user has no score yet.
 */
export async function getUserPosition(userId: string, period: LeaderboardPeriod, scope: LeaderboardScope) {
  const resolved = resolvePeriod(period)!;
  const userFilter = scope === 'friends' ? { userId: { in: [userId, ...(await getFriendIds(userId))] } } : {};

  const mine = await prisma.userScore.findUnique({
    where: { userId_periodType_periodStart: { userId, periodType: resolved.periodType, periodStart: resolved.periodStart } },
    select: { totalScore: true },
  });
  const score = mine?.totalScore ?? 0;

  const [ahead, nextAbove] = await Promise.all([
    prisma.userScore.count({ where: { ...resolved, ...userFilter, totalScore: { gt: score } } }),
    // The closest score above mine is the target to beat.
    prisma.userScore.findFirst({
      where: { ...resolved, ...userFilter, totalScore: { gt: score } },
      orderBy: { totalScore: 'asc' },
      select: { totalScore: true },
    }),
  ]);

  return {
    rank: mine ? ahead + 1 : null,
    score,
    // Overtaking the next player moves you up to their rank.
    pointsToNextRank: nextAbove ? nextAbove.totalScore - score + 1 : null,
  };
}

const RANK_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const OVERTAKE_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function recentlyNotified(userId: string, kind: string, since: Date, extra: Record<string, string> = {}) {
  const found = await prisma.userNotification.findFirst({
    where: {
      userId,
      createdAt: { gte: since },
      notification: {
        type: 'SOCIAL_ACTIVITY',
        AND: [{ data: { path: ['kind'], equals: kind } }, ...Object.entries(extra).map(([k, v]) => ({ data: { path: [k], equals: v } }))],
      },
    },
    select: { id: true },
  });
  return !!found;
}

/**
 * Called after a correct answer has been added to the weekly UserScore. Sends:
 *  - "You moved up to #N this week" to the answering user (top 10 only, rate-limited).
 *  - "<name> passed you" to friends whose weekly score was overtaken (once per pair per day).
 */
export async function notifyRankChanges(userId: string, pointsAwarded: number): Promise<void> {
  if (pointsAwarded <= 0) return;
  const now = new Date();
  const periodStart = getWeekStart(now);

  const mine = await prisma.userScore.findUnique({
    where: { userId_periodType_periodStart: { userId, periodType: 'WEEKLY', periodStart } },
    select: { totalScore: true, user: { select: { username: true, displayName: true } } },
  });
  if (!mine) return;

  const newScore = mine.totalScore;
  const oldScore = newScore - pointsAwarded;

  const [aheadBefore, aheadAfter] = await Promise.all([prisma.userScore.count({ where: { periodType: 'WEEKLY', periodStart, totalScore: { gt: oldScore }, userId: { not: userId } } }), prisma.userScore.count({ where: { periodType: 'WEEKLY', periodStart, totalScore: { gt: newScore } } })]);
  const rankBefore = aheadBefore + 1;
  const rankAfter = aheadAfter + 1;

  if (rankAfter < rankBefore && rankAfter <= 10 && !(await recentlyNotified(userId, 'rank_up', new Date(now.getTime() - RANK_NOTIFY_COOLDOWN_MS)))) {
    await notificationService.createAndQueueNotification({
      userId,
      type: 'SOCIAL_ACTIVITY',
      title: `You moved up to #${rankAfter} this week! 📈`,
      body: rankAfter === 1 ? "You're leading the weekly leaderboard. Keep it up!" : `Only ${rankAfter - 1} player${rankAfter === 2 ? '' : 's'} ahead of you. Keep answering to climb higher.`,
      data: { kind: 'rank_up', rank: String(rankAfter), screen: 'leaderboard' },
      channels: { push: true, email: false },
    });
  }

  // Friends whose weekly score sits in [oldScore, newScore) were just overtaken.
  const friendIds = await getFriendIds(userId);
  if (friendIds.length === 0) return;

  const overtaken = await prisma.userScore.findMany({
    where: { periodType: 'WEEKLY', periodStart, userId: { in: friendIds }, totalScore: { gte: oldScore, lt: newScore } },
    select: { userId: true },
  });
  const name = mine.user.displayName || mine.user.username;
  const since = new Date(now.getTime() - OVERTAKE_NOTIFY_COOLDOWN_MS);

  for (const { userId: friendId } of overtaken) {
    if (await recentlyNotified(friendId, 'overtaken', since, { byUserId: userId })) continue;
    await notificationService.createAndQueueNotification({
      userId: friendId,
      type: 'SOCIAL_ACTIVITY',
      title: `${name} just passed you! 🏃`,
      body: `${name} overtook you on this week's friends leaderboard. Answer your next drop to win your spot back.`,
      data: { kind: 'overtaken', byUserId: userId, screen: 'leaderboard' },
      channels: { push: true, email: false },
    });
  }
}
