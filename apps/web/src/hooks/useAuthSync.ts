'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/FirebaseProvider';
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
// @param getCredential — a function that performs the Firebase auth step and
//   returns a UserCredential. Accepts either loginWithEmail,
//   registerWithEmail, or signInWithGoogle results.
// ---------------------------------------------------------------------------

type AuthSyncOptions = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function useAuthSync({ onSuccess, onError }: AuthSyncOptions = {}) {
  const { loginWithEmail, registerWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const syncMutation = useMutation({
    mutationFn: (idToken: string) => makeAPICall('/auth/sync', { method: 'POST', body: { idToken } }),
    onSuccess: () => {
      onSuccess?.();
      router.push('/dashboard');
    },
    onError: (err: any) => {
      onError?.(err.message || 'An error occurred during backend synchronization.');
    },
  });

  // Shared internal helper: gets the idToken from any Firebase credential
  // and hands it to the sync mutation.
  const syncCredential = async (getCredential: () => Promise<{ user: { getIdToken: (force: boolean) => Promise<string> } }>) => {
    const credential = await getCredential();
    const idToken = await credential.user.getIdToken(false);
    await syncMutation.mutateAsync(idToken);
  };

  return {
    isPending: syncMutation.isPending,
    loginWithEmailSync: (email: string, password: string) => syncCredential(() => loginWithEmail(email, password)),
    registerWithEmailSync: (email: string, password: string) => syncCredential(() => registerWithEmail(email, password)),
    signInWithGoogleSync: () => syncCredential(() => signInWithGoogle()),
  };
}
