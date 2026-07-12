'use server';

import { PrismaClient } from '@trivioq/database';

const prisma = new PrismaClient();

export async function getDashboardMetrics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Run all aggregations concurrently in a single round trip
  const [
    totalUsers,
    // Users who last logged in BEFORE 30 days ago — used to estimate "existing" base
    usersActiveBeforeThirtyDays,
    premiumUsers,
    activeDropsToday,
    totalAnsweredDrops,
    correctDrops,
  ] = await Promise.all([
    prisma.user.count(),

    // The User model has no createdAt. We approximate monthly growth using lastLogin:
    // "users that existed before last month" = users whose lastLogin is older than 30 days.
    prisma.user.count({
      where: { lastLogin: { lt: thirtyDaysAgo } },
    }),

    prisma.user.count({
      where: { subscriptionTier: 'PREMIUM' },
    }),

    // Drops scheduled or delivered in the last 24 hours
    prisma.userDrop.count({
      where: { scheduledDropTime: { gte: twentyFourHoursAgo } },
    }),

    prisma.userDrop.count({
      where: { isAnswered: true },
    }),

    prisma.userDrop.count({
      where: { isAnswered: true, wasCorrect: true },
    }),
  ]);

  // Growth: new users this month / total users, expressed as a percentage
  const newUsersThisMonth = totalUsers - usersActiveBeforeThirtyDays;
  const userGrowthPct = totalUsers > 0 ? (newUsersThisMonth / totalUsers) * 100 : 0;

  const premiumConversionRate = totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0;

  const globalAccuracy = totalAnsweredDrops > 0 ? (correctDrops / totalAnsweredDrops) * 100 : 0;

  return {
    totalUsers,
    userGrowthPct: parseFloat(userGrowthPct.toFixed(1)),
    newUsersThisMonth,
    activeDropsToday,
    premiumConversionRate: parseFloat(premiumConversionRate.toFixed(1)),
    premiumUsers,
    globalAccuracy: parseFloat(globalAccuracy.toFixed(1)),
    correctDrops,
    totalAnsweredDrops,
  };
}

export type DailyActiveUser = { date: string; users: number };

export async function getDailyActiveUsers(): Promise<DailyActiveUser[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Raw SQL: group by day, count distinct users who had a drop scheduled
  const rows = await prisma.$queryRaw<{ day: Date; users: bigint }[]>`
    SELECT
      DATE_TRUNC('day', "scheduledDropTime") AS day,
      COUNT(DISTINCT "userId")              AS users
    FROM "UserDrop"
    WHERE "scheduledDropTime" >= ${thirtyDaysAgo}
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10), // "YYYY-MM-DD"
    users: Number(r.users),
  }));
}

export type CategoryPopularity = { name: string; questions: number };

export async function getCategoryPopularity(): Promise<CategoryPopularity[]> {
  const categories = await prisma.category.findMany({
    select: {
      name: true,
      _count: { select: { questions: true } },
    },
    orderBy: { questions: { _count: 'desc' } },
    take: 10,
  });

  return categories.map((c) => ({
    name: c.name,
    questions: c._count.questions,
  }));
}

export type QuestionStats = {
  totalQuestions: number;
  byCategory: { id: string; name: string; count: number }[];
};

export async function getQuestionStats(): Promise<QuestionStats> {
  const [totalQuestions, categories] = await Promise.all([
    prisma.question.count(),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { questions: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    totalQuestions,
    byCategory: categories.map((c) => ({
      id: c.id,
      name: c.name,
      count: c._count.questions,
    })),
  };
}
