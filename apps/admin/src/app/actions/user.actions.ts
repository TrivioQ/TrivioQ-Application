'use server';

import { PrismaClient, SubscriptionTier } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        lastLogin: 'desc',
      },
    });
    return { success: true, data: users };
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

export async function updateUser(userId: string, data: { username: string; displayName?: string; subscriptionTier: SubscriptionTier }) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data,
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
