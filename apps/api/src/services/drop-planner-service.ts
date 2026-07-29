import { prisma } from '@trivioq/database';
import { scheduleRemainingDropsForUser } from './drop-orchestrator';
import { CronManager } from '../lib/cron-manager';

/**
 * Plan drops for every USER-role user in the DB, evenly spaced inside each user's active window.
 * Run daily at 00:00 UTC.
 */
export async function scheduleDailyDrops(signal?: AbortSignal): Promise<void> {
  const now = new Date();
  console.log('[DropPlanner] scheduleDailyDrops running at', now.toISOString());

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });

  console.log(`[DropPlanner] Planning drops for ${users.length} users`);

  const BATCH_SIZE = 100;
  let failedCount = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('TERMINATED_BY_ADMIN');

    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((u) => scheduleRemainingDropsForUser(u.id, { now })));

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      failedCount += failed.length;
      console.error(`[DropPlanner] ${failed.length} user(s) failed to schedule in this batch.`);
    }
  }

  if (failedCount > 0) {
    console.error(`[DropPlanner] Total ${failedCount} user(s) failed to schedule.`);
  }
}

export function initDropPlanner(): void {
  CronManager.register('Daily Drop Planner', '0 0 * * *', async (signal) => {
    await scheduleDailyDrops(signal);
  });
}
