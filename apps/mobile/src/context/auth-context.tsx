import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged, User, signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebase';
import apiClient from '../api/client';
import { env } from '../config/env';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with real Web Client ID from Firebase Console
});

interface AuthContextType {
  user: User | null;
  userId: string | null;
  pushToken: string | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On Android emulator, localhost refers to the emulator itself, not the host machine.
  // We swap the host to 10.0.2.2 (the Android emulator's alias for the host machine).
  const API_URL = Platform.OS === 'android' ? env.API_URL.replace('127.0.0.1', '10.0.2.2').replace('localhost', '10.0.2.2') : env.API_URL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setUserId(currentUser ? currentUser.uid : null);

      if (currentUser) {
        await syncUserWithBackend(currentUser);

        const token = await registerForPushNotificationsAsync();
        if (token) {
          setPushToken(token);
          await syncTokenWithBackend(token);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const syncUserWithBackend = async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();
      await fetch(`${API_URL}/api/v1/auth/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Successfully synced user with Postgres backend!');
    } catch (error) {
      console.error('Failed to sync user with backend:', error);
    }
  };

  const syncTokenWithBackend = async (token: string) => {
    try {
      // By using apiClient, the interceptor automatically attaches the Firebase ID token
      await apiClient.put('/api/v1/users/device-token', {
        devicePushToken: token,
      });
    } catch (error) {
      console.error('Failed to sync push token with backend:', error);
    }
  };

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
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
        return null;
      }

      try {
        token = (await Notifications.getDevicePushTokenAsync()).data;
      } catch (e) {
        console.log('Error getting native push token:', e);
      }
    }

    return token;
  }

  // --- Authentication Methods ---

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;
      if (!idToken) throw new Error('Google Sign-In: No ID token returned');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error('Google Sign-In failed', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId,
        pushToken,
        isLoading,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
