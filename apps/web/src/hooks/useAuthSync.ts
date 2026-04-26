'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthProvider';
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
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      makeAPICall('/auth/login', { method: 'POST', body: { email, password } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const signupMutation = useMutation({
    mutationFn: ({ email, password, username, displayName }: { email: string; password: string; username: string; displayName: string }) =>
      makeAPICall('/auth/signup', { method: 'POST', body: { email, password, username, displayName } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  return {
    isPending: loginMutation.isPending || signupMutation.isPending,
    loginWithEmailSync: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    registerWithEmailSync: (email: string, password: string, username: string, displayName: string) =>
      signupMutation.mutateAsync({ email, password, username, displayName }),
    // Google uses a server-side redirect — no async result to await.
    signInWithGoogleSync: () => {
      window.location.href = '/api/auth/google';
    },
  };
}
