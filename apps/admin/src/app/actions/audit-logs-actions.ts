'use server';

import { getAuditLogs as getAuditLogsFromDB } from '@trivioq/database';
import { unstable_noStore as noStore } from 'next/cache';

export async function getAuditLogs(page: number = 1, pageSize: number = 20, targetUserId?: string) {
  noStore();
  try {
    const offset = (page - 1) * pageSize;
    
    const { logs, total } = await getAuditLogsFromDB({
      offset,
      limit: pageSize,
      targetUserId,
    });

    return {
      success: true,
      data: {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return { success: false, error: 'Failed to fetch audit logs' };
  }
}
