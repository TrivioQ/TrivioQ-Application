import cron from 'node-cron';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const triviaDropsQueue = new Queue('trivia-drops', { connection });

// Run every minute
cron.schedule('* * * * *', async () => {
  console.log('Running cron job to find eligible users for trivia drops...');
  try {
    const now = new Date();

    // Find users eligible for a trivia drop
    // For this example, assuming activeWindowStart and activeWindowEnd encompass 'now'
    const eligibleUsers = await prisma.user.findMany({
      where: {
        activeWindowStart: { lte: now },
        activeWindowEnd: { gte: now },
      },
    });

    console.log(`Found ${eligibleUsers.length} eligible users.`);

    for (const user of eligibleUsers) {
      await triviaDropsQueue.add('drop-question', {
        userId: user.id,
        timestamp: now.getTime(),
      });
      console.log(`Added job to trivia-drops queue for user ${user.id}`);
    }
  } catch (error) {
    console.error('Error running trivia drop cron job:', error);
  }
});

console.log('node-cron job scheduler initialized.');
