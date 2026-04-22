import express, { Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { verifyFirebaseToken } from '../middleware/firebaseAuth';

const router = express.Router();

router.post('/sync', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    // These are injected securely by the verifyFirebaseToken middleware
    const firebaseUid = (req as any).firebaseUid;
    const email = (req as any).firebaseEmail;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Missing required Firebase claims (uid or email)' });
    }

    const now = new Date();
    // Setting up default window values for a completely new user
    const activeWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
    const activeWindowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);

    // Upsert efficiently syncs the session:
    // If they exist, we just bump their lastLogin timestamp.
    // If they are brand new, we provision their Postgres row and tie it to the Firebase UID.
    const user = await prisma.user.upsert({
      where: { firebaseUid },
      update: {
        lastLogin: now,
      },
      create: {
        firebaseUid,
        email,
        username: `user_${Math.random().toString(36).substring(2, 10)}`, // Auto-generate random handle
        currentStreak: 0,
        cumulativeScore: 0,
        activeWindowStart,
        activeWindowEnd,
        lastLogin: now,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Failed to sync user with Firebase Auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
