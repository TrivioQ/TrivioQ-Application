import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';

const router = express.Router();

// Mock auth middleware (for demonstration)
const requireAuth = (req: Request, res: Response, next: express.NextFunction) => {
  (req as any).userId = req.headers['x-user-id'] || 'default-user-id';
  next();
};

router.get('/friends', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Find all accepted friendships where the user is either the requester or the addressee
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });

    // Extract the IDs of the friends
    const friendIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));

    // Combine user's own ID with friend IDs
    const leaderboardIds = [userId, ...friendIds];

    // Fetch the users and sort them
    const leaderboard = await prisma.user.findMany({
      where: {
        id: { in: leaderboardIds },
      },
      select: {
        id: true,
        username: true,
        currentStreak: true,
        cumulativeScore: true,
      },
      orderBy: {
        cumulativeScore: 'desc',
      },
    });

    res.json({ leaderboard });
  } catch (error) {
    console.error('Failed to fetch friends leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
