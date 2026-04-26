'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/FirebaseProvider';
import { makeAPICallV1 } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PREMIUM';
}

export function useUserProfile() {
  const { user } = useAuth();

  return useQuery<UserProfile>({
    queryKey: ['userProfile', user?.uid],
    queryFn: async () => {
      const idToken = await user!.getIdToken();
      return makeAPICallV1<UserProfile>('user/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
