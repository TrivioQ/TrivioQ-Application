import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@trivioq/database';
import { emailService } from '../services/email-service';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

interface EmailJobData {
  userNotificationId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const emailWorker = new Worker<EmailJobData>(
  'emails',
  async (job: Job<EmailJobData>) => {
    const { userNotificationId, to, subject, html, text } = job.data;

    console.log(`Processing email to ${to}, job ${job.id}`);

    try {
      const result = await emailService.send({
        to,
        subject,
        html,
        text,
      });

      if (result.success) {
        // Update delivery status
        await prisma.userNotification.update({
          where: { id: userNotificationId },
          data: {
            emailDelivered: true,
            emailSentAt: new Date(),
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
            userId: (
              await prisma.userNotification.findUnique({
                where: { id: userNotificationId },
                select: { userId: true },
              })
            )?.userId || '',
            channel: 'EMAIL',
            status: 'SUCCESS',
            metadata: {
              messageId: result.messageId,
              to,
              subject,
            },
          },
        });

        console.log(`Email ${userNotificationId} delivered successfully to ${to}`);
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error(`Email delivery failed for ${to}:`, error);

      // Log failed delivery
      await prisma.notificationDeliveryLog.create({
        data: {
          notificationId: (
            await prisma.userNotification.findUnique({
              where: { id: userNotificationId },
              select: { notificationId: true },
            })
          )?.notificationId || '',
          userId: (
            await prisma.userNotification.findUnique({
              where: { id: userNotificationId },
              select: { userId: true },
            })
          )?.userId || '',
          channel: 'EMAIL',
          status: 'FAILED',
          error: error.message,
          metadata: {
            to,
            subject,
          },
        },
      });

      // Re-throw for retry (BullMQ will handle retries)
      throw error;
    }
  },
  {
    connection: connection as any,
    concurrency: 10,
  }
);

// Event handlers
emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
});

console.log('Email worker listening on "emails" queue...');

export { emailWorker };