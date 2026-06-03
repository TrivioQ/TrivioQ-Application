'use server';

import { PrismaClient, SubscriptionTier, Prisma } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export type UserFilters = {
  search?: string;
  tier?: SubscriptionTier;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export async function getUsers(filters: UserFilters = {}) {
  const { search, tier, page = 1, pageSize = 20, sortBy = 'lastLogin', sortOrder = 'desc' } = filters;
  try {
    const where = {
      ...(search
        ? {
            OR: [{ username: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }],
          }
        : {}),
      ...(tier ? { subscriptionTier: tier } : {}),
    };

    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

export async function toggleUserTier(userId: string, currentTier: SubscriptionTier) {
  try {
    const newTier = currentTier === 'FREE' ? 'PREMIUM' : 'FREE';
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: newTier },
      }),
      prisma.userSubscriptionHistory.create({
        data: { userId, tier: newTier, source: 'ADMIN_GRANT', startedAt: now },
      }),
    ]);
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user tier:', error);
    return { success: false, error: 'Failed to update user tier' };
  }
}

export async function updateUser(
  userId: string,
  data: {
    email: string;
    username: string;
    displayName?: string;
    dateOfBirth?: string;
    subscriptionTier: SubscriptionTier;
    subscriptionExpiresAt?: string;
    activeWindowStart: string;
    activeWindowEnd: string;
    onDemandTokens: number;
  },
) {
  try {
    const now = new Date();
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } });
    const tierChanged = existing && existing.subscriptionTier !== data.subscriptionTier;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.user.update({
        where: { id: userId },
        data: {
          email: data.email,
          username: data.username,
          displayName: data.displayName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          subscriptionTier: data.subscriptionTier,
          subscriptionExpiresAt: data.subscriptionTier === 'FREE' ? null : (data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : undefined),
          activeWindowStart: new Date(data.activeWindowStart),
          activeWindowEnd: new Date(data.activeWindowEnd),
          onDemandTokens: data.onDemandTokens,
        },
      }),
    ];

    if (tierChanged) {
      ops.push(
        prisma.userSubscriptionHistory.create({
          data: { userId, tier: data.subscriptionTier, source: 'ADMIN_GRANT', startedAt: now },
        }),
      );
    }

    await prisma.$transaction(ops);
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user:', error);
    return { success: false, error: 'Failed to update user. Username must be unique.' };
  }
}

export async function searchUsersByUsername(query: string) {
  if (!query.trim()) return { success: true, data: [] };
  try {
    const data = await prisma.user.findMany({
      where: { username: { contains: query, mode: 'insensitive' } },
      select: { id: true, username: true, email: true, subscriptionTier: true },
      take: 8,
      orderBy: { username: 'asc' },
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to search users:', error);
    return { success: false, data: [], error: 'Search failed' };
  }
}

export async function getSubscriptionHistory(userId: string, page = 1, pageSize = 20) {
  try {
    const skip = (page - 1) * pageSize;
    const [total, data] = await Promise.all([
      prisma.userSubscriptionHistory.count({ where: { userId } }),
      prisma.userSubscriptionHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error('Failed to fetch subscription history:', error);
    return { success: false, data: [], total: 0, page, pageSize, totalPages: 1, error: 'Failed to load history' };
  }
}

export async function deleteUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    return { success: false, error: 'Failed to delete user.' };
  }
}
