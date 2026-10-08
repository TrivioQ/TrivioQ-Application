import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('Missing EXPO_PUBLIC_API_URL. The app cannot launch without an API connection.');
}

// On the Android emulator, localhost is the emulator itself; 10.0.2.2 is the host machine.
const resolvedApiUrl = Platform.OS === 'android' ? API_URL.replace('127.0.0.1', '10.0.2.2').replace('localhost', '10.0.2.2') : API_URL;

export const env = {
  API_URL: resolvedApiUrl,
  // Public web app origin — used for invite links and the web subscription page.
  WEB_URL: process.env.EXPO_PUBLIC_WEB_URL || 'https://trivioq.com',
  // OAuth "Web client" ID from Firebase Console → Authentication → Google.
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
