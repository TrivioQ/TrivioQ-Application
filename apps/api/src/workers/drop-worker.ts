import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { executeImmediateDropForUser } from '../services/drop-orchestrator';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const dropWorker = new Worker(
  'drops-queue',
  async (job: Job) => {
    const { userId } = job.data as { userId: string; isMasteryDay: boolean; dailyLimit: number };
    console.log(`[DropWorker] Processing job ${job.id} for user ${userId}`);

    const scheduledFor = new Date(job.timestamp + (job.opts.delay ?? 0));
    const { dropId } = await executeImmediateDropForUser(userId, scheduledFor);

    if (!dropId) {
      console.warn(`[DropWorker] No drop created for job ${job.id} (user ${userId})`);
    }
  },
  {
    connection: connection as any,
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
