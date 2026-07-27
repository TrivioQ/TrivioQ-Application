import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma, DifficultyLevel, AgeRating } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';
import { getSettingNumber } from '../utils/settings';
import { NotificationService } from './notification-service';

export interface DropsQueuePayload {
  userId: string;
  isMasteryDay: boolean;
  dailyLimit: number;
}

// BullMQ is created once per process. We expose the same queue the cron uses so the
// onboarding endpoint can enqueue jobs with matching jobIds (and BullMQ will dedupe).
const connection: any = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
export const dropsQueue = new Queue<DropsQueuePayload, any, string>('drops-queue', { connection });

const notificationService = new NotificationService();

// ── Geometry helpers (kept consistent with the cron) ──────────────────────────

function msUntilWindowStart(windowStart: Date, from: Date): number {
  const todayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), windowStart.getUTCHours(), windowStart.getUTCMinutes(), windowStart.getUTCSeconds());
  const diff = todayStart - from.getTime();
  return Math.max(0, diff);
}

// ── Question pick waterfall (lifted from drop-worker.ts) ─────────────────────

const DIFFICULTY_ORDER: DifficultyLevel[] = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD];

function rollDifficulty(percentages: Record<string, number>): DifficultyLevel {
  const roll = Math.random() * 100;
  let cursor = 0;
  for (const level of DIFFICULTY_ORDER) {
    const key = level as string;
    cursor += percentages[key] ?? 0;
    if (roll < cursor) return level;
  }
  return DIFFICULTY_ORDER.reduce((best, lvl) => ((percentages[lvl] ?? 0) >= (percentages[best] ?? 0) ? lvl : best));
}

async function pickStandardQuestion(userId: string, categoryIds: string[], startDifficulty: DifficultyLevel, allowedRatings: AgeRating[]): Promise<string | null> {
  const remaining = DIFFICULTY_ORDER.filter((d) => d !== startDifficulty);
  const tryOrder = [startDifficulty, ...remaining];
  for (const difficulty of tryOrder) {
    const question = await prisma.question.findFirst({
      where: {
        difficultyLevel: difficulty,
        ageRating: { in: allowedRatings },
        ...(categoryIds.length > 0 && {
          categories: { some: { id: { in: categoryIds } } },
        }),
        drops: { none: { userId, isViewed: true } },
      },
      select: { id: true },
    });
    if (question) return question.id;
  }
  return null;
}

function computeAllowedRatings(dateOfBirth: string | null | undefined, now: Date): AgeRating[] {
  if (!dateOfBirth) return ['ALL'];
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return ['ALL'];
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const hasBirthdayPassed = now.getUTCMonth() > dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
  if (!hasBirthdayPassed) age--;
  if (age >= 18) return ['ALL', 'TEEN', 'MATURE'];
  if (age >= 16) return ['ALL', 'TEEN'];
  return ['ALL'];
}

async function resolveCategoryIds(prefs: UserPreferences | null): Promise<string[]> {
  if (!prefs?.categoryPercentages) return [];
  const categoryNames = Object.keys(prefs.categoryPercentages);
  if (categoryNames.length === 0) return [];
  const categories = await prisma.category.findMany({
    where: { name: { in: categoryNames } },
    select: { id: true },
  });
  return categories.map((c) => c.id);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Schedule the remaining drops for today for a single user inside their active window.
 * Used both by the daily 00:00 UTC planner (bulk) and the onboarding endpoint (single user).
 */
export async function scheduleRemainingDropsForUser(userId: string, opts: { now: Date; isMasteryDay?: boolean } = { now: new Date() }): Promise<{ scheduled: number }> {
  const now = opts.now;
  const [user, freeLimit, premiumLimit] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        currentStreak: true,
        activeWindowStart: true,
        activeWindowEnd: true,
      },
    }),
    getSettingNumber('max_drops_free', 7),
    getSettingNumber('max_drops_premium', 100),
  ]);
  if (!user) return { scheduled: 0 };

  const isMasteryDay = opts.isMasteryDay !== undefined ? opts.isMasteryDay : user.currentStreak > 0 && user.currentStreak % 7 === 0;
  const dailyLimit = user.subscriptionTier === 'PREMIUM' ? premiumLimit : freeLimit;

  const windowMs = user.activeWindowEnd.getTime() - user.activeWindowStart.getTime();
  const windowMinutes = Math.max(1, Math.floor(windowMs / 60_000));
  const baseIntervalMs = (windowMinutes / dailyLimit) * 60_000;
  const windowOffsetMs = msUntilWindowStart(user.activeWindowStart, now);

  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < dailyLimit; i++) {
    const jitterMs = (Math.random() * 10 - 5) * 60_000;
    const delayMs = Math.max(0, windowOffsetMs + i * baseIntervalMs + jitterMs);
    const scheduledFor = new Date(now.getTime() + delayMs);

    jobs.push(dropsQueue.add('schedule-drop', { userId, isMasteryDay, dailyLimit }, { delay: delayMs, jobId: `drop-${userId}-${scheduledFor.getTime()}` }));
  }

  await Promise.all(jobs);
  return { scheduled: jobs.length };
}

/**
 * Run the question-pick + UserDrop-create + FCM-notify pipeline once for a single user.
 * Synchronous; intended for the onboarding "first drop" path and reused by the worker.
 */
export async function executeImmediateDropForUser(userId: string, scheduledForOverride?: Date): Promise<{ dropId: string | null }> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true, dateOfBirth: true },
  });
  if (!user) {
    console.warn(`[DropOrchestrator] User ${userId} not found — skipping immediate drop`);
    return { dropId: null };
  }

  const prefs = user.preferences as unknown as UserPreferences | null;
  const allowedRatings = computeAllowedRatings(user.dateOfBirth, now);
  const categoryIds = await resolveCategoryIds(prefs);

  const difficultyPercentages: Record<string, number> = prefs?.difficultyPercentages ?? { EASY: 50, MEDIUM: 30, HARD: 20 };
  const targetDifficulty = rollDifficulty(difficultyPercentages);

  const questionId = await pickStandardQuestion(userId, categoryIds, targetDifficulty, allowedRatings);
  if (!questionId) {
    console.warn(`[DropOrchestrator] No eligible question found for user ${userId} — skipping immediate drop`);
    return { dropId: null };
  }

  const dropExpiryMinutes = await getSettingNumber('drop_expiry_minutes', 30);
  const expirationTime = new Date(now.getTime() + dropExpiryMinutes * 60_000);

  const userDrop = await prisma.userDrop.create({
    data: {
      userId,
      questionId,
      scheduledDropTime: now,
      expirationTime,
      scheduledFor: scheduledForOverride ?? now,
    },
  });

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      difficultyLevel: true,
      categories: { select: { name: true }, take: 1 },
    },
  });

  const result = await notificationService.sendTriviaDropNotification({
    userId,
    dropId: userDrop.id,
    expirationTime,
    difficulty: question?.difficultyLevel ?? 'MIXED',
    category: question?.categories[0]?.name ?? 'Trivia',
    dropExpiryMinutes,
  });

  if (result.fcmSuccess) {
    console.log(`[DropOrchestrator] Notification sent for drop ${userDrop.id}`);
  } else if (result.error) {
    console.warn(`[DropOrchestrator] Notification failed for drop ${userDrop.id}:`, (result.error as Error).message);
  }

  return { dropId: userDrop.id };
}
