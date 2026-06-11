import { Worker } from 'bullmq';
process.env.TZ = 'UTC';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'trivia-drops',
  async (job) => {
    console.log(`Processing trivia drop job ${job.id} for user ${job.data.userId}`);

    // Example logic for processing a trivia drop:
    // In a real application, you might select a random question
    // and create a UserDrop record in the database using prisma.
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});

console.log('BullMQ Worker is running and listening to "trivia-drops" queue...');
