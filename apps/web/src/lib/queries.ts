'use client';

import { useQuery } from '@tanstack/react-query';
import type { DropHistoryFilter, DropHistoryItem, LeaderboardPosition, MistakeQuestion, NotificationPreferences, PracticeResult, TodayProgress, UserSearchResult } from '@trivioq/shared-types';
import { makeAPICallV1 } from './api';
import { useAuth } from '../context/auth-provider';

export type LeaderboardScope = 'global' | 'friends';
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';

export const api = {
  today: () => makeAPICallV1<TodayProgress>('users/me/today'),
  dropHistory: ({ filter, category, cursor, limit = 15 }: { filter: DropHistoryFilter; category: string | null; cursor?: string | null; limit?: number }) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (filter !== 'all') qs.set('result', filter);
    if (category) qs.set('category', category);
    if (cursor) qs.set('cursor', cursor);
    return makeAPICallV1<{ drops: DropHistoryItem[]; nextCursor: string | null }>(`users/me/recent-drops?${qs}`);
  },
  leaderboardMe: (scope: LeaderboardScope, period: LeaderboardPeriod) => makeAPICallV1<LeaderboardPosition>(`leaderboards/me?scope=${scope}&period=${period}`),
  mistakes: async () => (await makeAPICallV1<{ questions: MistakeQuestion[] }>('users/me/mistakes?limit=20')).questions,
  practice: (questionId: string, selectedOptionIndex: number) => makeAPICallV1<PracticeResult>(`users/me/practice/${questionId}`, { method: 'POST', body: { selectedOptionIndex } }),
  searchUsers: async (q: string) => (await makeAPICallV1<{ users: UserSearchResult[] }>(`users/search?q=${encodeURIComponent(q)}`)).users,
  notificationPrefs: async () => (await makeAPICallV1<{ preferences: NotificationPreferences }>('notifications/preferences')).preferences,
  updateNotificationPrefs: async (prefs: Partial<NotificationPreferences>) => (await makeAPICallV1<{ preferences: NotificationPreferences }>('notifications/preferences', { method: 'PUT', body: prefs })).preferences,
};

export function useToday() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['today'], queryFn: api.today, enabled: !!user, refetchInterval: 60_000 });
}

export function useLeaderboardPosition(scope: LeaderboardScope, period: LeaderboardPeriod, enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['leaderboardMe', scope, period], queryFn: () => api.leaderboardMe(scope, period), enabled: !!user && enabled });
}

/** "in 2h 15m" style label for an upcoming ISO time. */
export function formatUntil(iso: string, t: (key: string, values?: Record<string, any>) => string) {
  const mins = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t('inHoursMinutes', { h, m }) : t('inMinutes', { m });
}
