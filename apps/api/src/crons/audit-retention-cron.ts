import { cleanupOldAuditLogs } from '@trivioq/database';

export const runAuditRetentionCron = async () => {
  try {
    console.log('[audit-retention-cron] Cleaning up old audit logs (older than 1 year)...');
    const count = await cleanupOldAuditLogs();
    console.log(`[audit-retention-cron] Deleted ${count} old audit logs.`);
  } catch (error) {
    console.error('[audit-retention-cron] Error:', error);
  }
};
