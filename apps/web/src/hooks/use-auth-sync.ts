'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useNotification } from '../context/notification-context';
import { useAuth } from '../context/auth-provider';
import { makeAPICall } from '../lib/api';

// ---------------------------------------------------------------------------
// useAuthSync
//
// Orchestrates email/password auth flows against the Next.js server routes,
// which call Firebase REST API server-side. No Firebase client SDK is used.
// Google sign-in uses a full-page redirect to /api/auth/google.
// ---------------------------------------------------------------------------

type AuthSyncOptions = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function useAuthSync({ onSuccess, onError }: AuthSyncOptions = {}) {
  const { error: notifyError } = useNotification();
  const { refreshUser } = useAuth();
  const router = useRouter();

  const handleSuccess = async () => {
    await refreshUser();
    onSuccess?.();
    router.push('/dashboard');
  };

  const handleError = (err: any) => {
    const msg = err?.message || 'An unexpected error occurred.';
    notifyError(msg, 'Authentication failed');
    onError?.(msg);
  };

  const loginMutation = useMutation({
    mutationFn: ({ email, password, keepMeLoggedIn }: { email: string; password: string; keepMeLoggedIn: boolean }) => makeAPICall('/auth/login', { method: 'POST', body: { email, password, keepMeLoggedIn } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const signupMutation = useMutation({
    mutationFn: ({ email, password, username, displayName, dateOfBirth }: { email: string; password: string; username: string; displayName: string; dateOfBirth: string }) => makeAPICall('/auth/signup', { method: 'POST', body: { email, password, username, displayName, dateOfBirth } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  return {
    isPending: loginMutation.isPending || signupMutation.isPending,
    loginWithEmailSync: (email: string, password: string, keepMeLoggedIn: boolean) => loginMutation.mutateAsync({ email, password, keepMeLoggedIn }),
    registerWithEmailSync: (email: string, password: string, username: string, displayName: string, dateOfBirth: string) => signupMutation.mutateAsync({ email, password, username, displayName, dateOfBirth }),
    // Google uses a server-side redirect — no async result to await.
    signInWithGoogleSync: () => {
      window.location.href = '/api/auth/google';
    },
  };
}
