import { useQuery } from '@tanstack/react-query';
import type { DropHistoryFilter, DropHistoryItem, LeaderboardEntry, LeaderboardPosition, MistakeQuestion, NotificationPreferences, PracticeResult, TodayProgress, UserSearchResult } from '@trivioq/shared-types';
import apiClient from './client';
import { useAuth } from '../context/auth-context';

export interface MeProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  dateOfBirth: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PLUS' | 'PREMIUM';
  subscriptionExpiresAt: string | null;
  preferences: Record<string, any> | null;
  activeWindowStart: string | null;
  activeWindowEnd: string | null;
  onboardingComplete: boolean;
  questionsAnswered: number;
  correctAnswers: number;
}

export interface ScorePeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string | null;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  rank: number | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export const queryKeys = {
  me: ['userMe'] as const,
  today: ['today'] as const,
  activeDrop: ['activeDrop'] as const,
  scoreHistory: (period: 'weekly' | 'monthly') => ['scoreHistory', period] as const,
  dropHistory: (filter: DropHistoryFilter, category: string | null) => ['dropHistory', filter, category] as const,
  leaderboard: (scope: string, period: string) => ['leaderboard', scope, period] as const,
  leaderboardMe: (scope: string, period: string) => ['leaderboardMe', scope, period] as const,
  friendships: ['friendships'] as const,
  categories: ['categories'] as const,
  notificationPrefs: ['notificationPrefs'] as const,
  mistakes: ['mistakes'] as const,
  stats: ['publicStats'] as const,
};

export const api = {
  me: async () => (await apiClient.get<MeProfile>('/v1/users/me')).data,
  today: async () => (await apiClient.get<TodayProgress>('/v1/users/me/today')).data,
  scoreHistory: async (period: 'weekly' | 'monthly') => (await apiClient.get<{ history: ScorePeriod[] }>(`/v1/users/me/score-history?period=${period}`)).data.history ?? [],
  dropHistory: async (params: { filter: DropHistoryFilter; category: string | null; cursor?: string | null; limit?: number }) => {
    const qs = new URLSearchParams({ limit: String(params.limit ?? 15) });
    if (params.filter !== 'all') qs.set('result', params.filter);
    if (params.category) qs.set('category', params.category);
    if (params.cursor) qs.set('cursor', params.cursor);
    return (await apiClient.get<{ drops: DropHistoryItem[]; nextCursor: string | null }>(`/v1/users/me/recent-drops?${qs}`)).data;
  },
  leaderboard: async (scope: 'global' | 'friends', period: 'weekly' | 'monthly' | 'alltime') => (await apiClient.get<{ leaderboard: LeaderboardEntry[] }>(`/v1/leaderboards/${scope}?period=${period}`)).data.leaderboard ?? [],
  leaderboardMe: async (scope: 'global' | 'friends', period: 'weekly' | 'monthly' | 'alltime') => (await apiClient.get<LeaderboardPosition>(`/v1/leaderboards/me?scope=${scope}&period=${period}`)).data,
  categories: async () => (await apiClient.get<{ categories: CategoryOption[] }>('/v1/categories/list')).data.categories,
  mistakes: async () => (await apiClient.get<{ questions: MistakeQuestion[] }>('/v1/users/me/mistakes?limit=20')).data.questions,
  practice: async (questionId: string, selectedOptionIndex: number) => (await apiClient.post<PracticeResult>(`/v1/users/me/practice/${questionId}`, { selectedOptionIndex })).data,
  searchUsers: async (q: string) => (await apiClient.get<{ users: UserSearchResult[] }>(`/v1/users/search?q=${encodeURIComponent(q)}`)).data.users,
  updatePreferences: async (body: Record<string, unknown>) => (await apiClient.put('/v1/users/preferences', body)).data,
  notificationPrefs: async () => (await apiClient.get<{ preferences: NotificationPreferences }>('/v1/notifications/preferences')).data.preferences,
  updateNotificationPrefs: async (prefs: Partial<NotificationPreferences>) => (await apiClient.put<{ preferences: NotificationPreferences }>('/v1/notifications/preferences', prefs)).data.preferences,
  completeOnboarding: async (body: { categoryNames: string[]; activeWindowStart: string; activeWindowEnd: string; acceptTrial: true }) => (await apiClient.post('/v1/onboarding/complete', body)).data,
  // Public, unauthenticated.
  stats: async () => (await apiClient.get<{ activeLearners: number; questionsAnswered: number; activeCategories: number }>('/v1/stats')).data,
};

/** The signed-in user's API profile (DB id, not the Firebase uid). */
export function useMe() {
  const { userId } = useAuth();
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me, enabled: !!userId, staleTime: 30_000 });
}

export function useToday() {
  const { userId } = useAuth();
  return useQuery({ queryKey: queryKeys.today, queryFn: api.today, enabled: !!userId, refetchInterval: 60_000 });
}
