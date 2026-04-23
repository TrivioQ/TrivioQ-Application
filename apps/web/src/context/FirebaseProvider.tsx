'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, UserCredential } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

import { env } from '../../env.mjs';

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Analytics conditionally (only in browser environments where supported)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<UserCredential>;
  registerWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  loginWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    return await signInWithPopup(auth, googleProvider);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    return await createUserWithEmailAndPassword(auth, email, pass);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    return await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
};
