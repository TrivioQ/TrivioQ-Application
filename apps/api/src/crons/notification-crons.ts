/**
 * Notification Cron Jobs
 * Handles scheduled notifications: subscription reminders, promotions, and daily reminders
 */

import cron from 'node-cron';
import { prisma } from '@trivioq/database';
import { NotificationService } from '../services/notification-service';
import { NotificationType } from '@trivioq/shared-types';

// ── Subscription Expiry Reminders ──────────────────────────────────────────────

/**
 * Send reminders to users whose subscriptions expire soon
 * - 7 days before expiry
 * - 3 days before expiry
 * - 1 day before expiry
 */
export function initSubscriptionReminderCron() {
  // Run daily at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    console.log('[subscription-reminder-cron] Sending subscription expiry reminders...');
    try {
      const now = new Date();
      const notificationService = new NotificationService(prisma);

      // Find subscriptions expiring in 7, 3, and 1 days
      const expiringSoon = await prisma.subscription.findMany({
        where: {
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          },
          status: 'ACTIVE',
        },
        include: {
          user: true,
        },
      });

      for (const subscription of expiringSoon) {
        const daysUntilExpiry = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Skip if already reminded today
        const recentReminder = await prisma.userNotification.findFirst({
          where: {
            userId: subscription.userId,
            type: 'SUBSCRIPTION_REMINDER' as NotificationType,
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        });

        if (recentReminder) continue;

        let title: string;
        let body: string;

        if (daysUntilExpiry <= 1) {
          title = 'Subscription Expiring Soon!';
          body = `Your subscription expires tomorrow. Renew now to continue enjoying premium features!`;
        } else if (daysUntilExpiry <= 3) {
          title = 'Only 3 Days Left!';
          body = `Your subscription expires in ${daysUntilExpiry} days. Don't miss out on premium features!`;
        } else {
          title = '1 Week Until Expiry';
          body = `Your subscription expires in ${daysUntilExpiry} days. Renew early to avoid interruption!`;
        }

        await notificationService.createAndQueueNotification({
          userId: subscription.userId,
          type: 'SUBSCRIPTION_REMINDER',
          title,
          body,
          data: {
            subscriptionId: subscription.id,
            daysUntilExpiry,
            tier: subscription.tier,
          },
          channels: {
            push: true,
            email: daysUntilExpiry <= 3, // Only send email for urgent reminders
          },
        });

        console.log(`Sent subscription reminder to user ${subscription.userId} (${daysUntilExpiry} days)`);
      }

      console.log(`[subscription-reminder-cron] Completed. Processed ${expiringSoon.length} subscriptions.`);
    } catch (error) {
      console.error('[subscription-reminder-cron] Error:', error);
    }
  });
}

// ── Re-engagement Notifications (Inactive Users) ───────────────────────────────

/**
 * Send re-engagement notifications to users who haven't answered in a while
 * - 3 days inactive: gentle nudge
 * - 7 days inactive: special encouragement
 * - 14 days inactive: win-back offer
 */
export function initReengagementCron() {
  // Run daily at 10:00 AM UTC
  cron.schedule('0 10 * * *', async () => {
    console.log('[reengagement-cron] Sending re-engagement notifications...');
    try {
      const now = new Date();
      const notificationService = new NotificationService(prisma);

      // Find users who haven't answered in 3, 7, or 14 days
      const inactiveUsers = await prisma.user.findMany({
        where: {
          lastAnsweredAt: {
            lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
          // Only send to users who have previously answered
          lastAnsweredAt: { not: null },
        },
        include: {
          subscription: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      for (const user of inactiveUsers) {
        if (!user.lastAnsweredAt) continue;

        const daysInactive = Math.ceil(
          (now.getTime() - user.lastAnsweredAt.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Skip if already sent a re-engagement notification in the last 2 days
        const recentNotification = await prisma.userNotification.findFirst({
          where: {
            userId: user.id,
            type: { in: ['SYSTEM_ANNOUNCEMENT', 'OFFER_PROMOTION'] as NotificationType[] },
            createdAt: {
              gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            },
          },
        });

        if (recentNotification) continue;

        let title: string;
        let body: string;
        let type: NotificationType = 'SYSTEM_ANNOUNCEMENT';

        if (daysInactive >= 14) {
          title = 'We Miss You! 🎁';
          body = "It's been a while! Come back and answer today's trivia drop. Your streak is waiting!";
          type = 'OFFER_PROMOTION';
        } else if (daysInactive >= 7) {
          title = 'Your Streak Awaits! 🔥';
          body = `It's been ${daysInactive} days. Jump back in and keep your knowledge sharp!`;
        } else {
          title = 'New Trivia Awaits! 🧠';
          body = 'You have a new trivia drop waiting. Ready to test your knowledge?';
        }

        await notificationService.createAndQueueNotification({
          userId: user.id,
          type,
          title,
          body,
          data: { daysInactive, lastStreak: user.currentStreak },
          channels: {
            push: true,
            email: daysInactive >= 14, // Send email for win-back offers
          },
        });

        console.log(`Sent re-engagement to user ${user.id} (${daysInactive} days inactive)`);
      }

      console.log(`[reengagement-cron] Completed.`);
    } catch (error) {
      console.error('[reengagement-cron] Error:', error);
    }
  });
}

// ── Daily Trivia Reminder ───────────────────────────────────────────────────────

/**
 * Send daily trivia reminders to users during their active window
 * For users who haven't answered their daily drop yet
 */
export function initDailyTriviaReminderCron() {
  // Run every 3 hours from 8 AM to 8 PM UTC
  cron.schedule('0 8,11,14,17,20 * * *', async () => {
    console.log('[daily-trivia-cron] Sending daily trivia reminders...');
    try {
      const now = new Date();
      const notificationService = new NotificationService(prisma);

      // Find users who haven't answered today but have an active window now
      const usersWithoutAnswer = await prisma.user.findMany({
        where: {
          // User's active window includes now
          activeWindowStart: { lte: now },
          activeWindowEnd: { gte: now },
          // Hasn't answered today (assuming lastAnsweredAt is before today)
          OR: [
            { lastAnsweredAt: null },
            {
              lastAnsweredAt: {
                lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              },
            },
          ],
        },
      });

      for (const user of usersWithoutAnswer) {
        // Skip if user already has an active drop they haven't answered
        const activeDrop = await prisma.questionDrop.findFirst({
          where: {
            userId: user.id,
            status: 'PENDING',
            expiresAt: { gt: now },
          },
        });

        if (activeDrop) {
          // Send a gentle reminder about the pending drop
          const recentDropReminder = await prisma.userNotification.findFirst({
            where: {
              userId: user.id,
              type: 'TRIVIA_DROP' as NotificationType,
              createdAt: {
                gte: new Date(now.getTime() - 4 * 60 * 60 * 1000), // Last 4 hours
              },
            },
          });

          if (!recentDropReminder) {
            await notificationService.createAndQueueNotification({
              userId: user.id,
              type: 'TRIVIA_DROP',
              title: 'Your Trivia Drop is Waiting! 🎯',
              body: "You have an active trivia drop. Don't let it expire!",
              data: { dropId: activeDrop.id },
              channels: { push: true, email: false },
            });
          }
        }
      }

      console.log(`[daily-trivia-cron] Completed.`);
    } catch (error) {
      console.error('[daily-trivia-cron] Error:', error);
    }
  });
}

// ── Weekly Summary Notification ─────────────────────────────────────────────────

/**
 * Send weekly activity summaries to users every Sunday evening
 */
export function initWeeklySummaryCron() {
  // Run every Sunday at 7:00 PM UTC
  cron.schedule('0 19 * * 0', async () => {
    console.log('[weekly-summary-cron] Sending weekly summaries...');
    try {
      const now = new Date();
      const notificationService = new NotificationService(prisma);
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);

      // Get users who have been active this week
      const activeUsers = await prisma.user.findMany({
        where: {
          lastAnsweredAt: { gte: weekStart },
        },
      });

      for (const user of activeUsers) {
        // Calculate weekly stats
        const answersThisWeek = await prisma.questionAnswer.count({
          where: {
            userId: user.id,
            createdAt: { gte: weekStart },
          },
        });

        const correctAnswers = await prisma.questionAnswer.count({
          where: {
            userId: user.id,
            createdAt: { gte: weekStart },
            isCorrect: true,
          },
        });

        const pointsEarned = await prisma.questionAnswer.aggregate({
          where: {
            userId: user.id,
            createdAt: { gte: weekStart },
          },
          _sum: { pointsEarned: true },
        });

        if (answersThisWeek > 0) {
          const accuracy = Math.round((correctAnswers / answersThisWeek) * 100);

          await notificationService.createAndQueueNotification({
            userId: user.id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: 'Your Weekly Summary 📊',
            body: `This week: ${answersThisWeek} questions, ${accuracy}% accuracy, +${pointsEarned._sum.pointsEarned || 0} points!`,
            data: {
              answersThisWeek,
              correctAnswers,
              accuracy,
              pointsEarned: pointsEarned._sum.pointsEarned || 0,
            },
            channels: { push: true, email: true },
          });
        }
      }

      console.log(`[weekly-summary-cron] Sent summaries to ${activeUsers.length} users.`);
    } catch (error) {
      console.error('[weekly-summary-cron] Error:', error);
    }
  });
}

// ── Export initialization function ──────────────────────────────────────────────

export function initNotificationCrons() {
  initSubscriptionReminderCron();
  initReengagementCron();
  initDailyTriviaReminderCron();
  initWeeklySummaryCron();
  console.log('Notification cron jobs initialized.');
}