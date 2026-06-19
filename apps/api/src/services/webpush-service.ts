import webPush, { PushMessage } from 'web-push';
import { prisma } from '@trivioq/database';

// VAPID keys should be generated once and stored in environment variables
// Run: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

const vapidDetails = {
  subject: process.env.VAPID_SUBJECT || 'mailto:support@trivioq.com',
  publicKey: vapidKeys.publicKey,
  privateKey: vapidKeys.privateKey,
};

// Configure VAPID details if keys are available
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webPush.setVapidDetails(vapidDetails.subject, vapidKeys.publicKey, vapidKeys.privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface PushResult {
  success: boolean;
  endpoint?: string;
  error?: string;
}

export class WebPushService {
  /**
   * Get the VAPID public key for client-side subscription
   */
  getVapidPublicKey(): string {
    return vapidKeys.publicKey;
  }

  /**
   * Send a push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<PushResult[]> {
    const subscriptions = await prisma.webPushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return [{ success: false, error: 'No active subscriptions for user' }];
    }

    const results: PushResult[] = [];

    for (const subscription of subscriptions) {
      const result = await this.sendToSubscription(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
      results.push(result);

      // Clean up invalid subscriptions
      if (result.error?.includes('410') || result.error?.includes('404')) {
        await prisma.webPushSubscription.delete({
          where: { id: subscription.id },
        }).catch(() => {
          // Ignore cleanup errors
        });
      }
    }

    return results;
  }

  /**
   * Send a push notification to a subscription
   */
  async sendToSubscription(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: PushPayload
  ): Promise<PushResult> {
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      return { success: false, error: 'VAPID keys not configured' };
    }

    const pushPayload: PushMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/badge-72.png',
        data: payload.data,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction ?? false,
      },
    };

    try {
      const sendResult = await webPush.sendNotification(subscription, JSON.stringify(pushPayload));

      return {
        success: sendResult.statusCode === 201 || sendResult.statusCode === 204,
        endpoint: subscription.endpoint,
      };
    } catch (error: any) {
      console.error('Web push error:', error);

      // Check for subscription errors that should trigger cleanup
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or no longer valid
        return {
          success: false,
          endpoint: subscription.endpoint,
          error: `Subscription invalid (status ${error.statusCode})`,
        };
      }

      return {
        success: false,
        endpoint: subscription.endpoint,
        error: error.message || 'Failed to send push notification',
      };
    }
  }

  /**
   * Send a notification push (question drop alert)
   */
  async sendNotificationDrop(
    userId: string,
    dropId: string,
    category: string,
    difficulty: string,
    expirationTimestamp: number,
    dropExpiryMinutes: number = 30
  ): Promise<PushResult[]> {
    const capitalizedDifficulty =
      difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();

    const payload: PushPayload = {
      title: '🚨 New TrivioQ Drop!',
      body: `A ${capitalizedDifficulty} ${category} question is waiting. You have ${dropExpiryMinutes} minutes.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: {
        type: 'TRIVIA_DROP',
        dropId,
        expirationTimestamp: expirationTimestamp.toString(),
        url: '/dashboard',
      },
      tag: `drop-${dropId}`,
      requireInteraction: true,
      actions: [
        {
          action: 'answer',
          title: 'Answer Now',
          icon: '/icons/action-answer.png',
        },
        {
          action: 'dismiss',
          title: 'Later',
          icon: '/icons/action-dismiss.png',
        },
      ],
    };

    return this.sendToUser(userId, payload);
  }

  /**
   * Send a general notification push
   */
  async sendGeneralNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<PushResult[]> {
    const payload: PushPayload = {
      title,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: {
        type: 'GENERAL',
        ...data,
        url: '/dashboard/notifications',
      },
      tag: `notif-${Date.now()}`,
    };

    return this.sendToUser(userId, payload);
  }

  /**
   * Broadcast to all subscribed users
   */
  async broadcastToAll(title: string, body: string, data?: Record<string, any>): Promise<PushResult[]> {
    const subscriptions = await prisma.webPushSubscription.findMany();
    const results: PushResult[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < subscriptions.length; i += batchSize) {
      const batch = subscriptions.slice(i, i + batchSize);
      const batchPromises = batch.map(async (sub) => {
        const payload: PushPayload = {
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          data: {
            type: 'BROADCAST',
            ...data,
          },
        };
        return this.sendToSubscription(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }
}

// Singleton instance
export const webPushService = new WebPushService();