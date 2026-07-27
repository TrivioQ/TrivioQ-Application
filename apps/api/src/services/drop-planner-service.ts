import cron from 'node-cron';
import { prisma } from '@trivioq/database';
import { scheduleRemainingDropsForUser } from './drop-orchestrator';

/**
 * Plan drops for every USER-role user in the DB, evenly spaced inside each user's active window.
 * Run daily at 00:00 UTC.
 */
export async function scheduleDailyDrops(): Promise<void> {
  const now = new Date();
  console.log('[DropPlanner] scheduleDailyDrops running at', now.toISOString());

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });

  console.log(`[DropPlanner] Planning drops for ${users.length} users`);

  const results = await Promise.allSettled(users.map(async (u) => scheduleRemainingDropsForUser(u.id, { now })));

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[DropPlanner] ${failed.length} user(s) failed to schedule:`, failed);
  }
}

export function initDropPlanner(): void {
  cron.schedule('0 0 * * *', async () => {
    try {
      await scheduleDailyDrops();
    } catch (error) {
      console.error('[DropPlanner] Fatal error in scheduleDailyDrops:', error);
    }
  });

  console.log('[DropPlanner] initialized — will run daily at 00:00 UTC');
}
