import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';
import { prisma, DifficultyLevel } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';
import { getSettingNumber } from '../utils/settings';

try {
  admin.initializeApp();
} catch {
  // Already initialized by another worker in the same process
}

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

interface DropsQueuePayload {
  userId: string;
  isMasteryDay: boolean;
  dailyLimit: number;
}

// ── Mastery day: pick 1 question the user has already seen, in strict priority ─

async function pickMasteryQuestion(userId: string, sevenDaysAgo: Date): Promise<string | null> {
  // Priority 1: questions answered incorrectly (Mistakes)
  // Priority 2: questions viewed but not answered (Missed)
  // Priority 3: questions answered correctly (Reinforcement)
  const priorities: Array<{ isAnswered: boolean; wasCorrect?: boolean }> = [{ isAnswered: true, wasCorrect: false }, { isAnswered: false }, { isAnswered: true, wasCorrect: true }];

  for (const filter of priorities) {
    const drop = await prisma.userDrop.findFirst({
      where: {
        userId,
        isViewed: true,
        createdAt: { gte: sevenDaysAgo },
        ...(filter.wasCorrect !== undefined ? { isAnswered: filter.isAnswered, wasCorrect: filter.wasCorrect } : { isAnswered: filter.isAnswered }),
      },
      select: { questionId: true },
      orderBy: { createdAt: 'desc' },
    });

    if (drop) return drop.questionId;
  }

  return null;
}

// ── Standard day: weighted dice roll → unseen question with waterfall fallback ─

const DIFFICULTY_ORDER: DifficultyLevel[] = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD];

function rollDifficulty(percentages: Record<string, number>): DifficultyLevel {
  const roll = Math.random() * 100;
  let cursor = 0;

  // Walk in EASY → MEDIUM → HARD order so the roll is stable
  for (const level of DIFFICULTY_ORDER) {
    const key = level as string;
    cursor += percentages[key] ?? 0;
    if (roll < cursor) return level;
  }

  // Fallback to whichever level has the highest weight
  return DIFFICULTY_ORDER.reduce((best, lvl) => ((percentages[lvl] ?? 0) >= (percentages[best] ?? 0) ? lvl : best));
}

async function pickStandardQuestion(userId: string, categoryIds: string[], startDifficulty: DifficultyLevel): Promise<string | null> {
  // Waterfall: try startDifficulty first, then the others in descending weight order
  const remaining = DIFFICULTY_ORDER.filter((d) => d !== startDifficulty);
  const tryOrder = [startDifficulty, ...remaining];

  for (const difficulty of tryOrder) {
    const question = await prisma.question.findFirst({
      where: {
        difficultyLevel: difficulty,
        ...(categoryIds.length > 0 && {
          categories: { some: { id: { in: categoryIds } } },
        }),
        // Unseen filter: no drop for this user that has been viewed
        drops: { none: { userId, isViewed: true } },
      },
      select: { id: true },
    });

    if (question) return question.id;
  }

  return null;
}

// ── Worker ────────────────────────────────────────────────────────────────────

const dropWorker = new Worker<DropsQueuePayload>(
  'drops-queue',
  async (job: Job<DropsQueuePayload>) => {
    const { userId, isMasteryDay } = job.data;
    const now = new Date();

    console.log(`[DropWorker] Processing job ${job.id} for user ${userId} (mastery=${isMasteryDay})`);

    // 1. Load user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        preferences: true,
        devicePushToken: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      console.warn(`[DropWorker] User ${userId} not found — skipping job ${job.id}`);
      return;
    }

    const prefs = user.preferences as unknown as UserPreferences | null;

    // ── Part 1: Mastery Day ───────────────────────────────────────────────────
    let questionId: string | null = null;

    if (isMasteryDay) {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      questionId = await pickMasteryQuestion(userId, sevenDaysAgo);

      if (questionId) {
        console.log(`[DropWorker] Mastery question selected: ${questionId} for user ${userId}`);
      } else {
        console.log(`[DropWorker] No mastery history found for user ${userId} — falling back to standard logic`);
      }
    }

    // ── Part 2: Standard Day (or mastery fallback) ────────────────────────────
    if (!questionId) {
      const difficultyPercentages: Record<string, number> = prefs?.difficultyPercentages ?? { EASY: 50, MEDIUM: 30, HARD: 20 };

      // Resolve category names → IDs
      let categoryIds: string[] = [];
      if (prefs?.categoryPercentages) {
        const categoryNames = Object.keys(prefs.categoryPercentages);
        if (categoryNames.length > 0) {
          const categories = await prisma.category.findMany({
            where: { name: { in: categoryNames } },
            select: { id: true },
          });
          categoryIds = categories.map((c) => c.id);
        }
      }

      const targetDifficulty = rollDifficulty(difficultyPercentages);
      console.log(`[DropWorker] Rolled difficulty ${targetDifficulty} for user ${userId}`);

      questionId = await pickStandardQuestion(userId, categoryIds, targetDifficulty);
    }

    if (!questionId) {
      console.warn(`[DropWorker] No eligible question found for user ${userId} — dropping job ${job.id}`);
      return;
    }

    // ── Part 3: Execution ─────────────────────────────────────────────────────

    // 3a. Create UserDrop
    const dropExpiryMinutes = await getSettingNumber('drop_expiry_minutes', 30);
    const expirationTime = new Date(now.getTime() + dropExpiryMinutes * 60_000);

    const userDrop = await prisma.userDrop.create({
      data: {
        userId,
        questionId,
        scheduledDropTime: now,
        expirationTime,
        scheduledFor: new Date(job.timestamp + (job.opts.delay ?? 0)),
      },
    });

    console.log(`[DropWorker] Created UserDrop ${userDrop.id} for user ${userId}`);

    // 3b. FCM push notification
    if (!user.devicePushToken) {
      console.log(`[DropWorker] No push token for user ${userId} — skipping FCM`);
      return;
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        difficultyLevel: true,
        categories: { select: { name: true }, take: 1 },
      },
    });

    const category = question?.categories[0]?.name ?? 'Trivia';
    const difficulty = question?.difficultyLevel ?? 'MIXED';
    const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();

    const message: admin.messaging.Message = {
      notification: {
        title: '🚨 New TrivioQ Drop!',
        body: `A ${capitalizedDifficulty} ${category} question is waiting. You have ${dropExpiryMinutes} minutes.`,
      },
      data: {
        dropId: userDrop.id,
        expirationTimestamp: expirationTime.getTime().toString(),
      },
      token: user.devicePushToken,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`[DropWorker] FCM sent for drop ${userDrop.id}:`, response);
    } catch (error: any) {
      console.error(`[DropWorker] FCM failed for user ${userId}:`, error);

      if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
        await prisma.user.update({
          where: { id: userId },
          data: { devicePushToken: null },
        });
        console.log(`[DropWorker] Cleared stale push token for user ${userId}`);
      } else {
        // Transient FCM error — rethrow so BullMQ can retry
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: 10,
  },
);

dropWorker.on('completed', (job) => {
  console.log(`[DropWorker] Job ${job.id} completed`);
});

dropWorker.on('failed', (job, err) => {
  console.error(`[DropWorker] Job ${job?.id} failed:`, err);
});

console.log('[DropWorker] Listening on "drops-queue"...');
