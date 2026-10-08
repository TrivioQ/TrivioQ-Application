import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User, signInWithCredential, GoogleAuthProvider, EmailAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, reauthenticateWithCredential, updatePassword, deleteUser, signOut } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '../config/firebase';
import apiClient from '../api/client';
import { env } from '../config/env';
import { subscribeToPushNotifications } from '../lib/push-notification-service';

GoogleSignin.configure({
  webClientId: env.GOOGLE_WEB_CLIENT_ID,
});

interface AuthContextType {
  user: User | null;
  userId: string | null;
  isLoading: boolean;
  /** True when the account can sign in with a password (so it can change one). */
  isEmailUser: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, pass: string, username: string, displayName: string, dateOfBirth: string, referralCode?: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type SyncExtra = { username?: string; displayName?: string; dateOfBirth?: string; referralCode?: string };

async function syncUserWithBackend(firebaseUser: User, extraData?: SyncExtra) {
  const token = await firebaseUser.getIdToken();
  const response = await fetch(`${env.API_URL}/v1/auth/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(extraData ?? {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || 'Failed to sync account');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  // While an email sign-up is in flight, the auth listener must wait for it:
  // syncing without the chosen username/DOB would make the API create the
  // account with an auto-generated username and a default date of birth.
  const signupSync = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          if (signupSync.current) await signupSync.current;
          else await syncUserWithBackend(currentUser);
        } catch (error) {
          console.error('Failed to sync user with backend:', error);
        }
        subscribeToPushNotifications().catch((error) => console.error('Push registration failed:', error));
      }
      setUser(auth.currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await GoogleSignin.hasPlayServices();
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;
    if (!idToken) throw new Error('Google Sign-In: No ID token returned');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  };

  const registerWithEmail = async (email: string, pass: string, username: string, displayName: string, dateOfBirth: string, referralCode?: string) => {
    let resolveSync!: () => void;
    signupSync.current = new Promise<void>((resolve) => (resolveSync = resolve));
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
      try {
        await syncUserWithBackend(newUser, { username, displayName, dateOfBirth, ...(referralCode ? { referralCode } : {}) });
      } catch (error) {
        // Roll back so the user can retry with a different username.
        await deleteUser(newUser).catch(() => signOut(auth));
        throw error;
      }
    } finally {
      resolveSync();
      signupSync.current = null;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const current = auth.currentUser;
    if (!current?.email) throw new Error('Not signed in');
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, currentPassword));
    await updatePassword(current, newPassword);
  };

  // Schedules deletion (30-day grace period, reversible by signing in again), then signs out.
  const deleteAccount = async () => {
    await apiClient.delete('/v1/auth');
    await logout();
  };

  const logout = async () => {
    await GoogleSignin.signOut().catch(() => undefined);
    await signOut(auth);
    // The query cache is persisted to disk; never let it leak into the next account.
    queryClient.clear();
  };

  const isEmailUser = !!user?.providerData.some((p) => p.providerId === 'password');

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user ? user.uid : null,
        isLoading,
        isEmailUser,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendPasswordReset,
        changePassword,
        deleteAccount,
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
