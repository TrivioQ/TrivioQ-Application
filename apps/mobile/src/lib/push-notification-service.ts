/**
 * Push Notification Service for React Native (Expo)
 * Handles push notification permissions, subscriptions, and token management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiClient from '../api/client';

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }

    try {
      const projectId =
        require('../../app.json').expo?.extra?.eas?.projectId ??
        require('../../package.json').expo?.name;

      if (!projectId) {
        console.error('Could not find project ID for push notifications');
        return null;
      }

      const pushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = pushToken.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  } else {
    console.log('Must use physical device for push notifications');
  }

  return token;
}

/**
 * Subscribe to push notifications
 * Registers for notifications and sends token to backend
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    const token = await registerForPushNotificationsAsync();

    if (!token) {
      console.warn('Could not get push notification token');
      return false;
    }

    // Send token to backend
    const response = await apiClient.post('/api/v1/notifications/push/subscribe', {
      pushToken: token,
      deviceType: Platform.OS,
    });

    if (!response.ok) {
      throw new Error('Failed to save push subscription');
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
    const token = await Notifications.getExpoPushTokenAsync();

    await apiClient.delete('/api/v1/notifications/push/subscribe', {
      data: { pushToken: token.data },
    });

    console.log('Successfully unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check current notification permissions
 */
export async function getNotificationPermissionStatus(): Promise<{
  isSupported: boolean;
  isGranted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}> {
  const isSupported = Device.isDevice && (Platform.OS === 'ios' || Platform.OS === 'android');

  if (!isSupported) {
    return { isSupported: false, isGranted: false, status: 'undetermined' };
  }

  const { status } = await Notifications.getPermissionsAsync();

  return {
    isSupported: true,
    isGranted: status === 'granted',
    status,
  };
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null, // Show immediately
  });
}

/**
 * Schedule a notification for a specific time
 */
export async function scheduleNotificationForTime(
  title: string,
  body: string,
  triggerDate: Date,
  data?: any
) {
  const trigger = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    channelId: 'default',
    date: triggerDate.getTime(),
    repeats: false,
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count (for unread notifications)
 */
export async function getBadgeCountAsync(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCountAsync(count: number) {
  await Notifications.setBadgeCountAsync(count);
}