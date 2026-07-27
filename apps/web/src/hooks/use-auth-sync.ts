'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useNotification } from '../context/notification-context';
import { useAuth } from '../context/auth-provider';
import { makeAPICall, makeAPICallV1 } from '../lib/api';

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

interface UserMeShape {
  onboardingComplete?: boolean;
}

export function useAuthSync({ onSuccess, onError }: AuthSyncOptions = {}) {
  const { error: notifyError } = useNotification();
  const { refreshUser } = useAuth();
  const router = useRouter();
  const t = useTranslations('errors');

  const handleSuccess = async () => {
    // refreshUser refreshes the Firebase session; users/me carries the DB-side
    // onboardingComplete flag that determine whether to land on the dashboard
    // or in the onboarding wizard.
    await refreshUser();
    let onboardingComplete = true;
    try {
      const profile = await makeAPICallV1<UserMeShape>('users/me');
      onboardingComplete = profile?.onboardingComplete !== false;
    } catch {
      // If the profile fetch fails, treat as onboarded and fall through to /dashboard
      // (the dashboard page will re-check and redirect if needed).
      onboardingComplete = true;
    }
    onSuccess?.();
    router.push(onboardingComplete ? '/dashboard' : '/get-started');
  };

  const handleError = (err: any) => {
    const msg = err?.message || t('unexpectedError');
    notifyError(msg, t('authenticationFailed'));
    onError?.(msg);
  };

  const loginMutation = useMutation({
    mutationFn: ({ email, password, keepMeLoggedIn }: { email: string; password: string; keepMeLoggedIn: boolean }) => makeAPICall('/auth/login', { method: 'POST', body: { email, password, keepMeLoggedIn } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const signupMutation = useMutation({
    mutationFn: ({ email, password, username, displayName, dateOfBirth, referralCode }: { email: string; password: string; username: string; displayName: string; dateOfBirth: string; referralCode?: string }) => makeAPICall('/auth/signup', { method: 'POST', body: { email, password, username, displayName, dateOfBirth, ...(referralCode ? { referralCode } : {}) } }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  return {
    isPending: loginMutation.isPending || signupMutation.isPending,
    loginWithEmailSync: (email: string, password: string, keepMeLoggedIn: boolean) => loginMutation.mutateAsync({ email, password, keepMeLoggedIn }),
    registerWithEmailSync: (email: string, password: string, username: string, displayName: string, dateOfBirth: string, referralCode?: string) => signupMutation.mutateAsync({ email, password, username, displayName, dateOfBirth, referralCode }),
    // Google uses a server-side redirect — no async result to await.
    signInWithGoogleSync: () => {
      window.location.href = '/api/auth/google';
    },
  };
}
