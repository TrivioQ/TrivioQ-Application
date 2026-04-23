import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@trivioq/database';

const prisma = new PrismaClient();

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const firebaseUid = (req as any).firebaseUid;

  if (!firebaseUid) {
    return res.status(401).json({ error: 'Unauthorized: No firebase UID found. Ensure verifyFirebaseToken runs first.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Requires ADMIN privileges.' });
    }

    // Attach user to request for downstream use if needed
    (req as any).user = user;

    next();
  } catch (error) {
    console.error('requireAdmin middleware error:', error);
    return res.status(500).json({ error: 'Internal server error while verifying admin status.' });
  }
};
