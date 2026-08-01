'use server';

import { prisma, logAdminAction } from '@trivioq/database';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { env } from 'env';

export async function getUserDrops(userId: string, page: number = 1, pageSize: number = 20) {
  noStore();
  try {
    const skip = (page - 1) * pageSize;
    
    const [drops, total] = await Promise.all([
      prisma.userDrop.findMany({
        where: { userId },
        include: {
          question: {
            include: {
              categories: true,
              choices: true,
            }
          }
        },
        orderBy: { scheduledDropTime: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.userDrop.count({ where: { userId } })
    ]);

    return {
      success: true,
      data: {
        drops,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('Failed to get user drops:', error);
    return { success: false, error: 'Failed to fetch user drops' };
  }
}

async function getAdminUser(): Promise<{ email: string; id: string }> {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('tq_auth')?.value;
  if (!idToken) return { email: 'UNKNOWN_ADMIN', id: 'UNKNOWN_ID' };

  try {
    const upstream = await fetch(new URL('/v1/users/me', env.API_URL).toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (upstream.ok) {
      const user = await upstream.json();
      return { email: user?.email || 'UNKNOWN_ADMIN', id: user?.id || 'UNKNOWN_ID' };
    }
  } catch {
    // ignore
  }
  return { email: 'UNKNOWN_ADMIN', id: 'UNKNOWN_ID' };
}

export async function overrideUserDropResponse(dropId: string, newChoiceId: string | null, reason: string) {
  noStore();
  try {
    const adminUser = await getAdminUser();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('remote-addr') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;

    const userDrop = await prisma.userDrop.findUnique({
      where: { id: dropId },
      include: {
        question: {
          include: {
            choices: true,
          }
        },
        user: true,
      }
    });

    if (!userDrop) {
      return { success: false, error: 'Drop not found' };
    }

    if (!userDrop.isAnswered && !userDrop.answeredAt) {
        // We will allow overriding an expired or un-answered drop by treating it as answered now
    }

    let newIsCorrect = false;
    if (newChoiceId) {
      const selectedChoice = userDrop.question.choices.find(c => c.id === newChoiceId);
      if (!selectedChoice) {
        return { success: false, error: 'Invalid choice ID' };
      }
      newIsCorrect = selectedChoice.isCorrect;
    } else {
        return { success: false, error: 'Must provide a choice ID' };
    }

    const oldIsCorrect = userDrop.wasCorrect;

    if (oldIsCorrect === newIsCorrect && userDrop.selectedChoiceId === newChoiceId) {
       return { success: false, error: 'No change detected' };
    }

    let maxPoints = 10;
    if (userDrop.question.difficultyLevel === 'MEDIUM') maxPoints = 20;
    if (userDrop.question.difficultyLevel === 'HARD') maxPoints = 30;
    
    const pointsToAward = newIsCorrect ? Math.max(0, maxPoints - userDrop.hintCostDeducted) : 0;

    const pointDelta = pointsToAward - userDrop.pointsAwarded;
    const correctDelta = (newIsCorrect ? 1 : 0) - (oldIsCorrect ? 1 : 0);

    const answeredAt = userDrop.answeredAt || new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Update UserDrop
      await tx.userDrop.update({
        where: { id: dropId },
        data: {
          selectedChoiceId: newChoiceId,
          wasCorrect: newIsCorrect,
          pointsAwarded: pointsToAward,
          isAnswered: true,
          answeredAt: answeredAt,
        }
      });

      // 2. Update User
      await tx.user.update({
        where: { id: userDrop.userId },
        data: {
          cumulativeScore: { increment: pointDelta },
          correctAnswers: { increment: correctDelta },
          points: { increment: pointDelta }
        }
      });

      // 3. Update UserScore ledgers (Historical & Active)
      const ledgersToUpdate = await tx.userScore.findMany({
        where: {
            userId: userDrop.userId,
            periodStart: { lte: answeredAt },
            OR: [
                { periodEnd: { gte: answeredAt } },
                { periodEnd: null } // OVERALL
            ]
        }
      });

      for (const ledger of ledgersToUpdate) {
         await tx.userScore.update({
             where: { id: ledger.id },
             data: {
                 baseScore: { increment: pointDelta },
                 totalScore: { increment: pointDelta }
             }
         });
      }


    });

    // 5. New Admin Audit Log
    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      targetUserId: userDrop.userId,
      actionType: 'USER_DROP_OVERRIDE',
      resourceType: 'DROPS',
      previousState: {
        selectedChoiceId: userDrop.selectedChoiceId,
        wasCorrect: oldIsCorrect,
        pointsAwarded: userDrop.pointsAwarded,
        isAnswered: userDrop.isAnswered
      },
      newState: {
        selectedChoiceId: newChoiceId,
        wasCorrect: newIsCorrect,
        pointsAwarded: pointsToAward,
        isAnswered: true
      },
      reason,
      ipAddress,
      userAgent,
    });

    revalidatePath(`/users/${userDrop.user.username}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to override user drop:', error);
    return { success: false, error: 'Failed to override user drop' };
  }
}
