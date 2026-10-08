/**
 * Push Notification Service for React Native (Expo)
 * Handles permissions and native token registration with the API.
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
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }
}

/**
 * Ask for permission (if needed) and return the native device token (FCM on
 * Android, APNs on iOS) — the API sends pushes through Firebase Admin, not the
 * Expo push service, so an Expo push token would not work here.
 */
export async function getDevicePushToken(): Promise<string | null> {
  await ensureAndroidChannel();
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    finalStatus = (await Notifications.requestPermissionsAsync()).status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    return (await Notifications.getDevicePushTokenAsync()).data as string;
  } catch (error) {
    console.error('Error getting native push token:', error);
    return null;
  }
}

/** Registers this device for push with the API. Returns false if not permitted. */
export async function subscribeToPushNotifications(): Promise<boolean> {
  const token = await getDevicePushToken();
  if (!token) return false;
  try {
    await apiClient.put('/v1/users/device-token', { devicePushToken: token });
    return true;
  } catch (error) {
    console.error('Failed to register push token:', error);
    return false;
  }
}

/** Stops pushes to this device. */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    await apiClient.put('/v1/users/device-token', { devicePushToken: null });
    return true;
  } catch (error) {
    console.error('Failed to clear push token:', error);
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

export async function setBadgeCountAsync(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
