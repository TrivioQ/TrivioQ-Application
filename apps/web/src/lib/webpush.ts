/**
 * Web Push Service for Browser Notifications
 * Handles subscription management and service worker registration
 */

// VAPID public key - fetched from backend
let vapidPublicKey: string | null = null;

/**
 * Initialize web push by fetching VAPID public key
 */
export async function initWebPush(): Promise<string | null> {
  if (vapidPublicKey) return vapidPublicKey;

  try {
    const response = await fetch('/api/notifications/webpush/public-key');
    if (!response.ok) throw new Error('Failed to fetch VAPID key');
    const data = await response.json();
    vapidPublicKey = data.publicKey;
    return vapidPublicKey;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    return null;
  }
}

/**
 * Request notification permission and subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser');
    return false;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    if (!registration.active) {
      console.error('Service worker not active');
      return false;
    }

    // Get VAPID key
    const publicKey = await initWebPush();
    if (!publicKey) {
      console.error('VAPID public key not available');
      return false;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
    });

    // Send subscription to backend
    const jsonData = subscription.toJSON();
    const response = await fetch('/api/notifications/webpush/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: jsonData.endpoint,
        p256dh: jsonData.keys?.p256dh,
        auth: jsonData.keys?.auth,
        browser: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription');
    }

    console.log('Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Remove from backend
      await fetch('/api/notifications/webpush/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      console.log('Successfully unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check current push subscription status
 */
export async function getPushSubscriptionStatus(): Promise<{
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
}> {
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  if (!isSupported) {
    return { isSupported: false, isSubscribed: false, permission: 'default' };
  }

  const permission = Notification.permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    isSupported: true,
    isSubscribed: !!subscription,
    permission,
  };
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Send a local notification (for testing or when service worker receives push)
 */
export function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      ...options,
    });
  }
}
