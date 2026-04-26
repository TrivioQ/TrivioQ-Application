import { prisma } from '@trivioq/database';

// ── Point values per difficulty ──────────────────────────────────────────────
export const DIFFICULTY_POINTS: Record<string, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
};

// ── Bonus tables (index 0 = rank 1) ─────────────────────────────────────────
export const WEEKLY_BONUSES = [2500, 1500, 1000, 800, 700, 600, 500, 400, 300, 200];
export const MONTHLY_BONUSES = [10000, 6000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500];

// ── Period helpers ───────────────────────────────────────────────────────────

/** Returns the Monday 00:00:00 UTC of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns the Sunday 23:59:59.999 UTC of the week containing `date`. */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Returns the 1st of the current month at 00:00:00 UTC. */
export function getMonthStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns the last millisecond of the current month in UTC. */
export function getMonthEnd(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** A fixed epoch used as the periodStart key for the OVERALL record. */
export const OVERALL_PERIOD_START = new Date(0);

// ── Score upsert ─────────────────────────────────────────────────────────────

/**
 * Deducts points from OVERALL, MONTHLY, and WEEKLY UserScore rows.
 * Used for hint cost deductions. Scores are clamped to 0 (never go negative).
 */
export async function deductUserScores(userId: string, points: number): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  // Load current scores first so we can clamp
  const [overall, monthly, weekly] = await Promise.all([
    prisma.userScore.findUnique({ where: { userId_periodType_periodStart: { userId, periodType: 'OVERALL', periodStart: OVERALL_PERIOD_START } } }),
    prisma.userScore.findUnique({ where: { userId_periodType_periodStart: { userId, periodType: 'MONTHLY', periodStart: monthStart } } }),
    prisma.userScore.findUnique({ where: { userId_periodType_periodStart: { userId, periodType: 'WEEKLY', periodStart: weekStart } } }),
  ]);

  const clamp = (current: number) => Math.max(0, current - points);

  await prisma.$transaction([
    ...(overall
      ? [
          prisma.userScore.update({
            where: { id: overall.id },
            data: { baseScore: clamp(overall.baseScore), totalScore: clamp(overall.totalScore) },
          }),
        ]
      : []),
    ...(monthly
      ? [
          prisma.userScore.update({
            where: { id: monthly.id },
            data: { baseScore: clamp(monthly.baseScore), totalScore: clamp(monthly.totalScore) },
          }),
        ]
      : []),
    ...(weekly
      ? [
          prisma.userScore.update({
            where: { id: weekly.id },
            data: { baseScore: clamp(weekly.baseScore), totalScore: clamp(weekly.totalScore) },
          }),
        ]
      : []),
    // Also deduct from user's cumulativeScore
    prisma.user.update({
      where: { id: userId },
      data: { cumulativeScore: { decrement: points } },
    }),
  ]);
}

/**
 * Upserts UserScore rows for OVERALL, MONTHLY, and WEEKLY periods.
 * Called from the drop submit handler after awarding correct-answer points.
 */
export async function upsertUserScores(userId: string, points: number): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const monthStart = getMonthStart(now);
  const monthEnd = getMonthEnd(now);

  // All three upserts in a single transaction
  await prisma.$transaction([
    // OVERALL — single ever-growing row per user
    prisma.userScore.upsert({
      where: { userId_periodType_periodStart: { userId, periodType: 'OVERALL', periodStart: OVERALL_PERIOD_START } },
      create: { userId, periodType: 'OVERALL', periodStart: OVERALL_PERIOD_START, baseScore: points, totalScore: points },
      update: { baseScore: { increment: points }, totalScore: { increment: points } },
    }),
    // MONTHLY
    prisma.userScore.upsert({
      where: { userId_periodType_periodStart: { userId, periodType: 'MONTHLY', periodStart: monthStart } },
      create: { userId, periodType: 'MONTHLY', periodStart: monthStart, periodEnd: monthEnd, baseScore: points, totalScore: points },
      update: { baseScore: { increment: points }, totalScore: { increment: points } },
    }),
    // WEEKLY
    prisma.userScore.upsert({
      where: { userId_periodType_periodStart: { userId, periodType: 'WEEKLY', periodStart: weekStart } },
      create: { userId, periodType: 'WEEKLY', periodStart: weekStart, periodEnd: weekEnd, baseScore: points, totalScore: points },
      update: { baseScore: { increment: points }, totalScore: { increment: points } },
    }),
  ]);
}

// ── Bonus distribution ───────────────────────────────────────────────────────

/**
 * Awards end-of-period bonus points to the top-10 users for a given period.
 * Also increments the user's overall cumulativeScore.
 */
export async function distributeBonuses(periodType: 'WEEKLY' | 'MONTHLY', periodStart: Date): Promise<void> {
  const bonuses = periodType === 'WEEKLY' ? WEEKLY_BONUSES : MONTHLY_BONUSES;

  // Find top 10 rows ordered by baseScore for the completed period
  const topScores = await prisma.userScore.findMany({
    where: { periodType, periodStart },
    orderBy: { baseScore: 'desc' },
    take: 10,
    select: { id: true, userId: true, baseScore: true },
  });

  for (let i = 0; i < topScores.length; i++) {
    const bonus = bonuses[i] ?? 0;
    const { id, userId } = topScores[i];
    const rank = i + 1;

    await prisma.$transaction([
      // Record the bonus and rank in the period row
      prisma.userScore.update({
        where: { id },
        data: { bonusScore: bonus, totalScore: { increment: bonus }, rank },
      }),
      // Also credit the bonus to the user's all-time score
      prisma.user.update({ where: { id: userId }, data: { cumulativeScore: { increment: bonus } } }),
      // Also increment the OVERALL UserScore row
      prisma.userScore.updateMany({
        where: { userId, periodType: 'OVERALL', periodStart: OVERALL_PERIOD_START },
        data: { bonusScore: { increment: bonus }, totalScore: { increment: bonus } },
      }),
    ]);
  }

  console.log(`[scores] Distributed ${periodType} bonuses for period starting ${periodStart.toISOString()}`);
}
