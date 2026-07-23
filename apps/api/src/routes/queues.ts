import { Router, Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';

const router = Router();

const connection: any = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const queues = [new Queue('ai-question-generation', { connection }), new Queue('drops-queue', { connection }), new Queue('weekly-leaderboard', { connection })];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: queues.map((q) => new BullMQAdapter(q)),
  serverAdapter,
});

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return res.status(401).json({ error: 'Unauthorized: No session cookie' });
  }

  const cookies = parseCookies(cookieHeader);
  const token = cookies.tq_auth;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No session cookie' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const firebaseUid = decoded.uid;

    const user = await prisma.user.findUnique({ where: { firebaseUid } });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Requires ADMIN privileges.' });
    }

    (req as any).firebaseUid = firebaseUid;
    (req as any).user = user;
    next();
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Unauthorized: Session expired',
        code: 'auth/id-token-expired',
      });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

router.use(requireAdminAuth, serverAdapter.getRouter());

export default router;
