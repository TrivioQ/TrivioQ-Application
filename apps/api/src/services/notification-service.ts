import { prisma } from '@trivioq/database';
import {
  NotificationType,
  NotificationAudience,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin for FCM
try {
  admin.initializeApp();
} catch {
  // Already initialized by another process
}

interface CreateNotificationInput {
  type: NotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  targetUserIds?: string[];
  targetCriteria?: Record<string, any>;
  scheduledAt?: Date;
  createdBy?: string;
}

interface CreateFromTemplateInput {
  templateId: string;
  audience: NotificationAudience;
  variables: Record<string, string>;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  targetUserIds?: string[];
  targetCriteria?: Record<string, any>;
  scheduledAt?: Date;
  createdBy?: string;
}

interface TriviaDropNotificationInput {
  userId: string;
  dropId: string;
  expirationTime: Date;
  difficulty: string;
  category: string;
  dropExpiryMinutes: number;
}

export class NotificationService {
  private notificationQueue: Queue;
  private emailQueue: Queue;

  constructor() {
    const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });

    this.notificationQueue = new Queue('notifications', { connection });
    this.emailQueue = new Queue('emails', { connection });
  }

  /**
   * Send a trivia drop notification directly to a user
   * Combines database recording with FCM push delivery
   */
  async sendTriviaDropNotification(input: TriviaDropNotificationInput) {
    const { userId, dropId, expirationTime, difficulty, category, dropExpiryMinutes } = input;

    // Capitalize difficulty
    const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();

    // Create the notification record
    const notification = await prisma.notification.create({
      data: {
        type: NotificationType.TRIVIA_DROP,
        audience: NotificationAudience.SPECIFIC_USERS,
        title: '🚨 New TrivioQ Drop!',
        body: `A ${capitalizedDifficulty} ${category} question is waiting. You have ${dropExpiryMinutes} minutes.`,
        data: {
          dropId,
          expirationTimestamp: expirationTime.getTime(),
          difficulty,
          category,
        } as any,
        channels: [NotificationChannel.PUSH_MOBILE],
        status: NotificationStatus.SENDING,
        targetUserIds: [userId],
        totalRecipients: 1,
      },
    });

    // Create user notification record
    const userNotification = await prisma.userNotification.create({
      data: {
        notificationId: notification.id,
        userId,
      },
    });

    // Get user with push token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        devicePushToken: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      console.log(`[NotificationService] User ${userId} not found — skipping notification`);
      return { notification, userNotification, fcmSuccess: false };
    }

    // Check user preferences
    const prefs = user.notificationPreferences;
    if (prefs && !prefs.triviaDrop) {
      console.log(`[NotificationService] User ${userId} has trivia drops disabled — skipping push`);
      return { notification, userNotification, fcmSuccess: false };
    }

    // Send FCM push notification
    if (!user.devicePushToken) {
      console.log(`[NotificationService] No push token for user ${userId} — skipping FCM`);
      return { notification, userNotification, fcmSuccess: false };
    }

    const message: admin.messaging.Message = {
      notification: {
        title: '🚨 New TrivioQ Drop!',
        body: `A ${capitalizedDifficulty} ${category} question is waiting. You have ${dropExpiryMinutes} minutes.`,
      },
      data: {
        dropId,
        expirationTimestamp: expirationTime.getTime().toString(),
        type: 'TRIVIA_DROP',
      },
      token: user.devicePushToken,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`[NotificationService] FCM sent for drop ${dropId}:`, response);

      // Update user notification with delivery status
      await prisma.userNotification.update({
        where: { id: userNotification.id },
        data: { pushDelivered: true },
      });

      return { notification, userNotification, fcmSuccess: true };
    } catch (error: any) {
      console.error(`[NotificationService] FCM failed for user ${userId}:`, error);

      // Handle invalid token
      if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
        await prisma.user.update({
          where: { id: userId },
          data: { devicePushToken: null },
        });
        console.log(`[NotificationService] Cleared stale push token for user ${userId}`);
      }

      // Update notification status
      await prisma.userNotification.update({
        where: { id: userNotification.id },
        data: { pushDelivered: false, pushError: error.message },
      });

      return { notification, userNotification, fcmSuccess: false, error };
    }
  }

  /**
   * Create a notification from template with variable substitution
   */
  async createFromTemplate(input: CreateFromTemplateInput) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: input.templateId },
    });

    if (!template) {
      throw new Error(`Template not found: ${input.templateId}`);
    }

    if (!template.isActive) {
      throw new Error(`Template is not active: ${template.name}`);
    }

    // Substitute variables in title and body
    let title = template.title;
    let body = template.body;
    let emailSubject = template.emailSubject;
    let emailHtml = template.emailHtml;

    Object.entries(input.variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(placeholder, value);
      body = body.replace(placeholder, value);
      if (emailSubject) emailSubject = emailSubject.replace(placeholder, value);
      if (emailHtml) emailHtml = emailHtml.replace(placeholder, value);
    });

    return this.create({
      type: template.type,
      audience: input.audience,
      title,
      body,
      data: input.data,
      channels: input.channels || template.channels,
      targetUserIds: input.targetUserIds,
      targetCriteria: input.targetCriteria,
      scheduledAt: input.scheduledAt,
      createdBy: input.createdBy,
    });
  }

  /**
   * Create a new notification
   */
  async create(input: CreateNotificationInput) {
    // Resolve target users based on audience
    let targetUserIds = input.targetUserIds || [];
    let totalRecipients = 0;

    if (input.audience === NotificationAudience.ALL_USERS) {
      const users = await prisma.user.findMany({
        where: { role: 'USER' },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
      totalRecipients = targetUserIds.length;
    } else if (input.audience === NotificationAudience.USER_SEGMENT) {
      targetUserIds = await this.resolveSegmentCriteria(input.targetCriteria || {});
      totalRecipients = targetUserIds.length;
    } else {
      totalRecipients = targetUserIds.length;
    }

    const notification = await prisma.notification.create({
      data: {
        type: input.type,
        audience: input.audience,
        title: input.title,
        body: input.body,
        data: input.data as any,
        channels: input.channels,
        status: input.scheduledAt ? NotificationStatus.SCHEDULED : NotificationStatus.DRAFT,
        scheduledAt: input.scheduledAt,
        createdBy: input.createdBy,
        targetUserIds,
        targetCriteria: input.targetCriteria as any,
        totalRecipients,
      },
    });

    // If not scheduled, create UserNotification records but don't send yet
    if (!input.scheduledAt) {
      await this.createUserNotificationRecords(notification.id, targetUserIds);
    }

    // If scheduled for now, trigger delivery
    if (input.scheduledAt && input.scheduledAt <= new Date()) {
      await this.send(notification.id);
    }

    return notification;
  }

  /**
   * Create and immediately send a notification (convenience method)
   */
  async createAndSend(input: Omit<CreateNotificationInput, 'scheduledAt'>) {
    return this.create({
      ...input,
      scheduledAt: new Date(),
    });
  }

  /**
   * Trigger delivery of a notification
   */
  async send(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        userNotifications: {
          include: {
            user: {
              include: {
                notificationPreferences: true,
              },
            },
          },
        },
      },
    });

    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    if (notification.status === NotificationStatus.COMPLETED) {
      console.log(`Notification ${notificationId} already completed`);
      return;
    }

    // Update status to SENDING
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENDING,
        sentAt: new Date(),
      },
    });

    // Process each user notification
    for (const userNotification of notification.userNotifications) {
      await this.queueUserNotification(userNotification.id, notification.channels);
    }

    // Mark as completed
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.COMPLETED },
    });

    console.log(`Notification ${notificationId} sent to ${notification.userNotifications.length} users`);
  }

  /**
   * Get user's notification inbox
   */
  async getInbox(userId: string, limit = 50, offset = 0) {
    const userNotifications = await prisma.userNotification.findMany({
      where: { userId },
      include: {
        notification: {
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            data: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const unreadCount = await prisma.userNotification.count({
      where: { userId, isRead: false },
    });

    return {
      notifications: userNotifications.map((un) => ({
        id: un.id,
        notificationId: un.notification.id,
        type: un.notification.type,
        title: un.notification.title,
        body: un.notification.body,
        data: un.notification.data as any,
        isRead: un.isRead,
        pushDelivered: un.pushDelivered,
        emailDelivered: un.emailDelivered,
        readAt: un.readAt,
        clickedAt: un.clickedAt,
        createdAt: un.createdAt,
      })),
      unreadCount,
      totalCount: await prisma.userNotification.count({ where: { userId } }),
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userNotificationId: string) {
    return prisma.userNotification.update({
      where: { id: userNotificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string) {
    return prisma.userNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string) {
    let prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    // Create default preferences if not exists
    if (!prefs) {
      prefs = await prisma.userNotificationPreference.create({
        data: {
          userId,
          triviaDrop: true,
          systemAnnouncement: true,
          subscriptionReminder: true,
          offerPromotion: false,
          creditAlert: true,
          adminMessage: true,
          enablePushNotification: true,
          enableWebPushNotification: false,
          enableEmailNotification: true,
        },
      });
    }

    return prefs;
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    prefs: Partial<import('@prisma/client').UserNotificationPreference>
  ) {
    return prisma.userNotificationPreference.upsert({
      where: { userId },
      update: prefs,
      create: {
        userId,
        ...prefs,
      },
    });
  }

  /**
   * Subscribe to web push notifications
   */
  async subscribeWebPush(
    userId: string,
    subscription: { endpoint: string; p256dh: string; auth: string; browser?: string }
  ) {
    return prisma.webPushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        browser: subscription.browser,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        browser: subscription.browser,
      },
    });
  }

  /**
   * Unsubscribe from web push notifications
   */
  async unsubscribeWebPush(userId: string, endpoint: string) {
    return prisma.webPushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /**
   * Get notification analytics
   */
  async getAnalytics(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        userNotifications: true,
      },
    });

    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    const totalRecipients = notification.userNotifications.length;
    const deliveredCount = notification.userNotifications.filter(
      (un) => un.pushDelivered || un.emailDelivered
    ).length;
    const readCount = notification.userNotifications.filter((un) => un.isRead).length;
    const clickedCount = notification.userNotifications.filter((un) => un.clickedAt).length;

    return {
      totalRecipients,
      deliveredCount,
      readCount,
      clickedCount,
      deliveryRate: totalRecipients > 0 ? (deliveredCount / totalRecipients) * 100 : 0,
      readRate: deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0,
      clickRate: deliveredCount > 0 ? (clickedCount / deliveredCount) * 100 : 0,
    };
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Resolve segment criteria to user IDs
   */
  private async resolveSegmentCriteria(criteria: Record<string, any>): Promise<string[]> {
    const where: any = { role: 'USER' };

    // Subscription tier filter
    if (criteria.subscriptionTier) {
      where.subscriptionTier = criteria.subscriptionTier;
    }

    // Score filter
    if (criteria.minCumulativeScore) {
      where.cumulativeScore = { gte: criteria.minCumulativeScore };
    }

    // Streak filter
    if (criteria.minStreak) {
      where.currentStreak = { gte: criteria.minStreak };
    }

    // Last login filter (inactive users)
    if (criteria.lastLoginBefore) {
      where.lastLogin = { lt: new Date(criteria.lastLoginBefore) };
    }

    // Subscription expiring filter
    if (criteria.subscriptionExpiringInDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + criteria.subscriptionExpiringInDays);
      where.subscriptionExpiresAt = {
        lte: expiryDate,
        gt: new Date(),
      };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /**
   * Create UserNotification records for target users
   */
  private async createUserNotificationRecords(
    notificationId: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length === 0) return;

    // Batch create in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await prisma.userNotification.createMany({
        data: batch.map((userId) => ({
          notificationId,
          userId,
        })),
      });
    }
  }

  /**
   * Queue a user notification for delivery
   */
  private async queueUserNotification(
    userNotificationId: string,
    channels: NotificationChannel[]
  ): Promise<void> {
    const userNotification = await prisma.userNotification.findUnique({
      where: { id: userNotificationId },
      include: {
        notification: true,
        user: {
          include: {
            notificationPreferences: true,
            webPushSubscriptions: true,
          },
        },
      },
    });

    if (!userNotification) return;

    const prefs = userNotification.user.notificationPreferences;
    if (!prefs) return;

    // Check if user has enabled this notification type
    const typeEnabled = this.isTypeEnabled(userNotification.notification.type, prefs);
    if (!typeEnabled) return;

    // Queue for each channel
    for (const channel of channels) {
      if (channel === NotificationChannel.PUSH_MOBILE || channel === NotificationChannel.PUSH_WEB) {
        if (prefs.enablePushNotification || prefs.enableWebPushNotification) {
          await this.notificationQueue.add(
            'push-notification',
            {
              userNotificationId,
              channel,
              notification: {
                title: userNotification.notification.title,
                body: userNotification.notification.body,
                data: userNotification.notification.data,
                type: userNotification.notification.type,
              },
              user: {
                id: userNotification.user.id,
                devicePushToken: userNotification.user.devicePushToken,
                webPushSubscriptions: userNotification.user.webPushSubscriptions,
              },
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            }
          );
        }
      }

      if (channel === NotificationChannel.EMAIL) {
        if (prefs.enableEmailNotification && userNotification.user.email) {
          await this.emailQueue.add(
            'email-notification',
            {
              userNotificationId,
              to: userNotification.user.email,
              subject: userNotification.notification.title,
              html: this.renderEmailBody(
                userNotification.notification.body,
                userNotification.user.displayName || userNotification.user.username
              ),
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            }
          );
        }
      }
    }
  }

  /**
   * Check if notification type is enabled in preferences
   */
  private isTypeEnabled(
    type: NotificationType,
    prefs: import('@prisma/client').UserNotificationPreference
  ): boolean {
    switch (type) {
      case NotificationType.TRIVIA_DROP:
        return prefs.triviaDrop;
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return prefs.systemAnnouncement;
      case NotificationType.SUBSCRIPTION_REMINDER:
        return prefs.subscriptionReminder;
      case NotificationType.OFFER_PROMOTION:
        return prefs.offerPromotion;
      case NotificationType.CREDIT_ALERT:
        return prefs.creditAlert;
      case NotificationType.ADMIN_MESSAGE:
        return prefs.adminMessage;
      default:
        return true;
    }
  }

  /**
   * Render email body with personalization
   */
  private renderEmailBody(body: string, userName: string): string {
    // Simple HTML wrapper - can be enhanced with templates
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">TrivioQ</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>${body.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TrivioQ. All rights reserved.</p>
              <p>You're receiving this because you subscribed to TrivioQ notifications.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

// Singleton instance
export const notificationService = new NotificationService();