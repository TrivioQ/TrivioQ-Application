'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthProvider';
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

  // The catch-all proxy at /api/[...slug] reads the tq_auth httpOnly cookie
  // and injects it as the Authorization header — no token needed client-side.
  return useQuery<UserProfile>({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => makeAPICallV1<UserProfile>('users/me'),
    enabled: !!user,
    staleTime: 60_000,
  });
}
