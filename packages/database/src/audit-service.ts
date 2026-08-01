import { prisma } from './index';
import { Prisma } from '@prisma/client';

export type CreateAuditLogParams = {
  adminId: string;
  adminEmail?: string;
  targetUserId: string;
  actionType: string;
  resourceType: string;
  previousState?: any;
  newState?: any;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function logAdminAction(params: CreateAuditLogParams) {
  try {
    const log = await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        targetUserId: params.targetUserId,
        actionType: params.actionType,
        resourceType: params.resourceType,
        previousState: params.previousState ? (params.previousState as Prisma.InputJsonValue) : Prisma.JsonNull,
        newState: params.newState ? (params.newState as Prisma.InputJsonValue) : Prisma.JsonNull,
        reason: params.reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
    return log;
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // We intentionally don't throw here to prevent failing the main action
    // if the audit logging fails for some reason.
    return null;
  }
}

export async function getAuditLogs(options?: { adminId?: string; targetUserId?: string; actionType?: string; limit?: number; offset?: number }) {
  const where: Prisma.AdminAuditLogWhereInput = {};

  if (options?.adminId) where.adminId = options.adminId;
  if (options?.targetUserId) where.targetUserId = options.targetUserId;
  if (options?.actionType) where.actionType = options.actionType;

  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });

  const total = await prisma.adminAuditLog.count({ where });

  return { logs, total };
}

export async function cleanupOldAuditLogs() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const result = await prisma.adminAuditLog.deleteMany({
    where: {
      createdAt: {
        lt: oneYearAgo,
      },
    },
  });

  return result.count;
}
