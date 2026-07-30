import { Router, Request, Response } from 'express';
import { prisma } from '@trivioq/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const activeLearners = await prisma.user.count();

    const aggregations = await prisma.user.aggregate({
      _sum: { questionsAnswered: true },
    });

    const questionsAnswered = aggregations._sum.questionsAnswered || 0;

    const activeCategories = await prisma.category.count();

    res.json({
      activeLearners,
      questionsAnswered,
      activeCategories,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
