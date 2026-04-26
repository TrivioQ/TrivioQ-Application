import cron from 'node-cron';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';
import { UserPreferences } from '@trivioq/shared-types';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const dispatchNotificationsQueue = new Queue('dispatch-notifications', {
  connection,
});

// Helper to determine if a user should receive a drop right now
function shouldDrop(targetDropsPerWeek: number, activeWindowMinutes: number): boolean {
  // Weekly active minutes = active window minutes per day * 7 days
  const weeklyActiveMinutes = activeWindowMinutes * 7;

  if (weeklyActiveMinutes <= 0) return false;

  // Probability of dropping this minute
  const probability = targetDropsPerWeek / weeklyActiveMinutes;

  return Math.random() < probability;
}

cron.schedule('* * * * *', async () => {
  console.log('Running trivia drop scheduler...');
  try {
    const now = new Date();

    // 1. Find users whose activeWindowStart and activeWindowEnd encompass the current UTC time
    // For simplicity, assuming these DateTimes accurately map to today's date bounding the current absolute UTC time.
    const eligibleUsers = await prisma.user.findMany({
      where: {
        activeWindowStart: { lte: now },
        activeWindowEnd: { gte: now },
      },
    });

    for (let user of eligibleUsers) {
      // 1. Daily limit reset logic
      const isSameDay = user.lastDropDate.getUTCFullYear() === now.getUTCFullYear() && user.lastDropDate.getUTCMonth() === now.getUTCMonth() && user.lastDropDate.getUTCDate() === now.getUTCDate();

      if (!isSameDay) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            dropsReceivedToday: 0,
            lastDropDate: now,
          },
        });
      }

      // 2. Subscription tier limit enforcement
      const dailyLimit = user.subscriptionTier === 'PREMIUM' ? 100 : 30;
      if (user.dropsReceivedToday >= dailyLimit) {
        continue; // Skip user for this run as they've hit their daily cap
      }

      const prefs = user.preferences as unknown as UserPreferences | null;
      if (!prefs) continue;

      const targetDropsPerWeek = prefs.targetDropsPerWeek || 5;

      // Calculate active window minutes for this user
      const diffMs = user.activeWindowEnd.getTime() - user.activeWindowStart.getTime();
      const activeWindowMinutes = Math.max(1, Math.floor(diffMs / 60000));

      // 2. Use a randomized algorithm to determine if they should receive a drop right now
      if (shouldDrop(targetDropsPerWeek, activeWindowMinutes)) {
        // 3. Select a random question matching their category preferences
        const categories = prefs.categoryPercentages ? Object.keys(prefs.categoryPercentages) : [];
        let selectedCategory: string | undefined;

        if (categories.length > 0) {
          const rand = Math.random();
          let sum = 0;
          for (const [cat, weight] of Object.entries(prefs.categoryPercentages)) {
            sum += weight;
            if (rand <= sum) {
              selectedCategory = cat;
              break;
            }
          }
        }

        const questionQuery: any = {};
        if (selectedCategory) {
          questionQuery.categories = { some: { name: selectedCategory } };
        }

        const questions = await prisma.question.findMany({
          where: questionQuery,
          select: { id: true, difficultyLevel: true, categories: { select: { name: true } } },
        });

        if (questions.length === 0) continue; // No questions match preference

        // Pick a completely random question from the filtered subset
        const randomQ = questions[Math.floor(Math.random() * questions.length)];

        // Create the user drop expiring in 15 minutes
        const expirationTime = new Date(now.getTime() + 15 * 60000);

        const userDrop = await prisma.userDrop.create({
          data: {
            userId: user.id,
            questionId: randomQ.id,
            scheduledDropTime: now,
            expirationTime: expirationTime,
            isAnswered: false,
          },
        });

        // Update the user's daily count and strictly set lastDropDate
        await prisma.user.update({
          where: { id: user.id },
          data: {
            dropsReceivedToday: { increment: 1 },
            lastDropDate: now,
          },
        });

        // 4. Push a job to BullMQ queue named 'dispatch-notifications'
        await dispatchNotificationsQueue.add('send-drop-notification', {
          userId: user.id,
          dropId: userDrop.id,
          category: selectedCategory || 'Mixed',
          difficulty: randomQ.difficultyLevel,
          expirationTimestamp: expirationTime.getTime(),
        });

        console.log(`Successfully scheduled drop ${userDrop.id} for user ${user.id}`);
      }
    }
  } catch (error) {
    console.error('Scheduler encountered an error:', error);
  }
});

console.log('Advanced drop scheduler initialized.');
