import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';

// Initialize Firebase Admin
// Make sure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CONFIG is set in your env.
try {
  admin.initializeApp();
} catch (error) {
  // Ignore if already initialized, otherwise log
  console.log('Firebase init status:', error);
}

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

interface DispatchNotificationJob {
  userId: string;
  dropId: string;
  category: string;
  difficulty: string;
  expirationTimestamp: number;
  dropExpiryMinutes?: number;
}

const dispatcherWorker = new Worker<DispatchNotificationJob>(
  'dispatch-notifications',
  async (job: Job<DispatchNotificationJob>) => {
    const { userId, dropId, category, difficulty, expirationTimestamp, dropExpiryMinutes = 30 } = job.data;

    console.log(`Processing push notification for user ${userId}, drop ${dropId}`);

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { devicePushToken: true, id: true },
      });

      if (!user || !user.devicePushToken) {
        console.log(`Skipping notification: User ${userId} not found or missing devicePushToken.`);
        return;
      }

      const title = '🚨 New TrivioQ Drop!';
      const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      const body = `A ${capitalizedDifficulty} ${category} question is waiting. You have ${dropExpiryMinutes} minutes.`;

      const message = {
        notification: {
          title,
          body,
        },
        data: {
          dropId: dropId,
          expirationTimestamp: expirationTimestamp.toString(),
        },
        token: user.devicePushToken,
      };

      const response = await admin.messaging().send(message);
      console.log(`Successfully sent FCM message to user ${userId}:`, response);
    } catch (error: any) {
      console.error(`Failed to dispatch notification for user ${userId}:`, error);

      // Standard Firebase Admin error codes for invalid or unregistered tokens
      if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
        console.log(`Invalid token detected for user ${userId}. Cleaning up devicePushToken...`);
        await prisma.user.update({
          where: { id: userId },
          data: { devicePushToken: null },
        });
      } else {
        // Re-throw other transient errors so BullMQ can handle retries
        throw error;
      }
    }
  },
  { connection },
);

dispatcherWorker.on('completed', (job) => {
  console.log(`Dispatch job ${job.id} has completed!`);
});

dispatcherWorker.on('failed', (job, err) => {
  console.error(`Dispatch job ${job?.id} has failed:`, err);
});

console.log('Push notification dispatcher worker listening to "dispatch-notifications" queue...');
