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
const triviaDropsQueue = new bullmq_1.Queue('trivia-drops', { connection });
// Run every minute
node_cron_1.default.schedule('* * * * *', async () => {
  console.log('Running cron job to find eligible users for trivia drops...');
  try {
    const now = new Date();
    // Find users eligible for a trivia drop
    // For this example, assuming activeWindowStart and activeWindowEnd encompass 'now'
    const eligibleUsers = await database_1.prisma.user.findMany({
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
