'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/FirebaseProvider';
import { useNotification } from '../context/NotificationContext';
import { makeAPICall } from '../lib/api';

// ---------------------------------------------------------------------------
// useAuthSync
//
// Encapsulates the two-step Firebase auth + backend sync flow that is
// required on both login and signup:
//
//   Step 1 — Firebase Client SDK authenticates the user (browser-only,
//             cannot be moved to the server — see apps/web/src/app/api/auth)
//   Step 2 — Next.js /api/auth/sync route syncs the user record in Postgres
//             and sets the tq_auth httpOnly session cookie
//
// Errors are automatically surfaced as toast notifications via useNotification.
// ---------------------------------------------------------------------------

type AuthSyncOptions = {
  onSuccess?: () => void;
  /** Optional override — fires alongside the automatic error toast. */
  onError?: (message: string) => void;
};

export function useAuthSync({ onSuccess, onError }: AuthSyncOptions = {}) {
  const { loginWithEmail, registerWithEmail, signInWithGoogle } = useAuth();
  const { error: notifyError } = useNotification();
  const router = useRouter();

  const syncMutation = useMutation({
    mutationFn: (idToken: string) => makeAPICall('/auth/sync', { method: 'POST', body: { idToken } }),
    onSuccess: () => {
      onSuccess?.();
      router.push('/dashboard');
    },
    onError: (err: any) => {
      const msg = err.message || 'An error occurred during backend synchronization.';
      notifyError(msg, 'Authentication failed');
      onError?.(msg);
    },
  });

  // Shared internal helper: gets the idToken from any Firebase credential
  // and hands it to the sync mutation.
  const syncCredential = async (getCredential: () => Promise<{ user: { getIdToken: (force: boolean) => Promise<string> } }>) => {
    try {
      const credential = await getCredential();
      const idToken = await credential.user.getIdToken(false);
      await syncMutation.mutateAsync(idToken);
    } catch (err: any) {
      // Firebase-level errors (wrong password, user not found, etc.)
      const msg = err.message || 'Authentication failed.';
      notifyError(msg, 'Authentication failed');
      onError?.(msg);
    }
  };

  return {
    isPending: syncMutation.isPending,
    loginWithEmailSync: (email: string, password: string) => syncCredential(() => loginWithEmail(email, password)),
    registerWithEmailSync: (email: string, password: string) => syncCredential(() => registerWithEmail(email, password)),
    signInWithGoogleSync: () => syncCredential(() => signInWithGoogle()),
  };
}
