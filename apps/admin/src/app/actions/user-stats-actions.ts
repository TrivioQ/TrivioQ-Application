import { prisma } from '@trivioq/database';
import { unstable_noStore as noStore } from 'next/cache';

export async function getUserStats(username: string) {
  noStore();
  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Weekly and Monthly Performance
    const recentScores = await prisma.userScore.findMany({
      where: { userId: user.id },
      orderBy: { periodStart: 'desc' },
      take: 100,
    });

    const weeklyScore = recentScores.find(s => s.periodType === 'WEEKLY');
    const monthlyScore = recentScores.find(s => s.periodType === 'MONTHLY');

    const competitionsWon = await prisma.userScore.count({
      where: { userId: user.id, rank: 1 },
    });

    // Accuracy by Category
    // We'll fetch drops with question categories and aggregate in memory
    const recentDrops = await prisma.userDrop.findMany({
      where: { userId: user.id, isAnswered: true },
      include: {
        question: {
          include: {
            categories: true,
          }
        }
      },
      orderBy: { answeredAt: 'desc' },
      take: 1000,
    });

    const categoryStats: Record<string, { correct: number; total: number; name: string }> = {};

    recentDrops.forEach(drop => {
      drop.question.categories.forEach(cat => {
        if (!categoryStats[cat.id]) {
          categoryStats[cat.id] = { correct: 0, total: 0, name: cat.name };
        }
        categoryStats[cat.id].total += 1;
        if (drop.wasCorrect) {
          categoryStats[cat.id].correct += 1;
        }
      });
    });

    const accuracyByCategory = Object.values(categoryStats).map(stat => ({
      name: stat.name,
      accuracy: Math.round((stat.correct / stat.total) * 100) || 0,
      total: stat.total,
    })).sort((a, b) => b.total - a.total).slice(0, 10); // top 10 most answered

    return {
      success: true,
      data: {
        user,
        weeklyScore,
        monthlyScore,
        competitionsWon,
        accuracyByCategory,
        scoreHistory: recentScores,
      }
    };
  } catch (error) {
    console.error('Failed to get user stats:', error);
    return { success: false, error: 'Failed to fetch user stats' };
  }
}
