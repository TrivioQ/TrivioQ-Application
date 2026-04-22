'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const node_cron_1 = __importDefault(require('node-cron'));
const bullmq_1 = require('bullmq');
const ioredis_1 = __importDefault(require('ioredis'));
const database_1 = require('@trivioq/database');
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const dispatchNotificationsQueue = new bullmq_1.Queue('dispatch-notifications', {
  connection,
});
// Helper to determine if a user should receive a drop right now
function shouldDrop(targetDropsPerWeek, activeWindowMinutes) {
  // Weekly active minutes = active window minutes per day * 7 days
  const weeklyActiveMinutes = activeWindowMinutes * 7;
  if (weeklyActiveMinutes <= 0) return false;
  // Probability of dropping this minute
  const probability = targetDropsPerWeek / weeklyActiveMinutes;
  return Math.random() < probability;
}
node_cron_1.default.schedule('* * * * *', async () => {
  console.log('Running trivia drop scheduler...');
  try {
    const now = new Date();
    // 1. Find users whose activeWindowStart and activeWindowEnd encompass the current UTC time
    // For simplicity, assuming these DateTimes accurately map to today's date bounding the current absolute UTC time.
    const eligibleUsers = await database_1.prisma.user.findMany({
      where: {
        activeWindowStart: { lte: now },
        activeWindowEnd: { gte: now },
      },
    });
    for (let user of eligibleUsers) {
      // 1. Daily limit reset logic
      const isSameDay = user.lastDropDate.getUTCFullYear() === now.getUTCFullYear() && user.lastDropDate.getUTCMonth() === now.getUTCMonth() && user.lastDropDate.getUTCDate() === now.getUTCDate();
      if (!isSameDay) {
        user = await database_1.prisma.user.update({
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
      const prefs = user.preferences;
      if (!prefs) continue;
      const targetDropsPerWeek = prefs.targetDropsPerWeek || 5;
      // Calculate active window minutes for this user
      const diffMs = user.activeWindowEnd.getTime() - user.activeWindowStart.getTime();
      const activeWindowMinutes = Math.max(1, Math.floor(diffMs / 60000));
      // 2. Use a randomized algorithm to determine if they should receive a drop right now
      if (shouldDrop(targetDropsPerWeek, activeWindowMinutes)) {
        // 3. Select a random question matching their category preferences
        const categories = prefs.categoryPercentages ? Object.keys(prefs.categoryPercentages) : [];
        let selectedCategory;
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
        const questionQuery = {};
        if (selectedCategory) {
          questionQuery.categoryId = selectedCategory;
        }
        const questions = await database_1.prisma.question.findMany({
          where: questionQuery,
          select: { id: true, categoryId: true, difficultyLevel: true },
        });
        if (questions.length === 0) continue; // No questions match preference
        // Pick a completely random question from the filtered subset
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        // Create the user drop expiring in 15 minutes
        const expirationTime = new Date(now.getTime() + 15 * 60000);
        const userDrop = await database_1.prisma.userDrop.create({
          data: {
            userId: user.id,
            questionId: randomQ.id,
            scheduledDropTime: now,
            expirationTime: expirationTime,
            isAnswered: false,
          },
        });
        // Update the user's daily count and strictly set lastDropDate
        await database_1.prisma.user.update({
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
          category: randomQ.categoryId,
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
