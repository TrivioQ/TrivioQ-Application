'use server';

import { PrismaClient, SubscriptionTier } from '@trivioq/database';
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
      ...(search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ]
      } : {}),
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
      })
    ]);

    return { 
      success: true, 
      data, 
      total, 
      page, 
      pageSize, 
      totalPages: Math.max(1, Math.ceil(total / pageSize)) 
    };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

export async function toggleUserTier(userId: string, currentTier: SubscriptionTier) {
  try {
    const newTier = currentTier === 'FREE' ? 'PREMIUM' : 'FREE';
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: newTier },
    });
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user tier:', error);
    return { success: false, error: 'Failed to update user tier' };
  }
}

export async function updateUser(userId: string, data: { username: string; displayName?: string; dateOfBirth?: string; subscriptionTier: SubscriptionTier }) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        displayName: data.displayName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        subscriptionTier: data.subscriptionTier,
      },
    });
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user:', error);
    return { success: false, error: 'Failed to update user. Username must be unique.' };
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
