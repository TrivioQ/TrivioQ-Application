'use server';

import { prisma } from '@trivioq/database';
import { unstable_noStore as noStore } from 'next/cache';

export async function getUserFriendships(userId: string) {
  noStore();
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
      },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, email: true },
        },
        addressee: {
          select: { id: true, username: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: friendships };
  } catch (error) {
    console.error('Failed to get user friendships:', error);
    return { success: false, error: 'Failed to fetch friendships' };
  }
}

export async function removeAdminFriendship(friendshipId: string) {
  noStore();
  try {
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to delete friendship:', error);
    return { success: false, error: 'Failed to delete friendship' };
  }
}
