import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { webPushService } from '../services/webpush-service';

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (error) {
  console.log('Firebase admin already initialized or error:', error);
}

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

interface NotificationJobData {
  userNotificationId: string;
  channel: 'PUSH_MOBILE' | 'PUSH_WEB' | 'EMAIL';
  notification: {
    title: string;
    body: string;
    data?: any;
    type: string;
  };
  user: {
    id: string;
    devicePushToken?: string | null;
    webPushSubscriptions: Array<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
  };
}

const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    const { userNotificationId, channel, notification, user } = job.data;

    console.log(`Processing ${channel} notification for user ${user.id}, job ${job.id}`);

    try {
      if (channel === 'PUSH_MOBILE') {
        await sendMobilePush(userNotificationId, user, notification);
      } else if (channel === 'PUSH_WEB') {
        await sendWebPush(userNotificationId, user, notification);
      }

      // Update delivery status
      await prisma.userNotification.update({
        where: { id: userNotificationId },
        data: {
          pushDelivered: true,
          pushSentAt: new Date(),
        },
      });

      // Log successful delivery
      await prisma.notificationDeliveryLog.create({
        data: {
          notificationId: (
            await prisma.userNotification.findUnique({
              where: { id: userNotificationId },
              select: { notificationId: true },
            })
          )?.notificationId || '',
          userId: user.id,
          channel: channel === 'PUSH_MOBILE' ? 'PUSH_MOBILE' : 'PUSH_WEB',
          status: 'SUCCESS',
          metadata: {
            title: notification.title,
            type: notification.type,
          },
        },
      });

      console.log(`Notification ${userNotificationId} delivered successfully`);
    } catch (error: any) {
      console.error(`Notification delivery failed for user ${user.id}:`, error);

      // Log failed delivery
      await prisma.notificationDeliveryLog.create({
        data: {
          notificationId: (
            await prisma.userNotification.findUnique({
              where: { id: userNotificationId },
              select: { notificationId: true },
            })
          )?.notificationId || '',
          userId: user.id,
          channel: channel === 'PUSH_MOBILE' ? 'PUSH_MOBILE' : 'PUSH_WEB',
          status: 'FAILED',
          error: error.message,
        },
      });

      // Clean up invalid tokens
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        console.log(`Invalid FCM token for user ${user.id}. Cleaning up...`);
        await prisma.user.update({
          where: { id: user.id },
          data: { devicePushToken: null },
        });
      } else {
        // Re-throw for retry
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: 20,
  }
);

/**
 * Send mobile push notification via FCM
 */
async function sendMobilePush(
  userNotificationId: string,
  user: { id: string; devicePushToken?: string | null },
  notification: { title: string; body: string; data?: any }
): Promise<void> {
  if (!user.devicePushToken) {
    throw new Error('No device push token available');
  }

  const message: admin.messaging.Message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    token: user.devicePushToken,
    android: {
      priority: 'high',
      notification: {
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
          mutableContent: true,
        },
      },
    },
  };

  const response = await admin.messaging().send(message);
  console.log(`FCM sent successfully: ${response}`);
}

/**
 * Send web push notification
 */
async function sendWebPush(
  userNotificationId: string,
  user: { id: string; webPushSubscriptions: Array<any> },
  notification: { title: string; body: string; data?: any }
): Promise<void> {
  if (!user.webPushSubscriptions || user.webPushSubscriptions.length === 0) {
    throw new Error('No web push subscriptions available');
  }

  // Send to all active subscriptions for this user
  const results = await webPushService.sendToUser(user.id, {
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });

  const successCount = results.filter((r) => r.success).length;
  if (successCount === 0) {
    throw new Error('All web push deliveries failed');
  }

  console.log(`Web push sent: ${successCount}/${results.length} successful`);
}

// Event handlers
notificationWorker.on('completed', (job) => {
  console.log(`Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job ${job?.id} failed:`, err);
});

console.log('Notification worker listening on "notifications" queue...');

export { notificationWorker };