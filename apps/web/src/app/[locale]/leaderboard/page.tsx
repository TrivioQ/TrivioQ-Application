import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ErrorNotification } from '@/components/error-notification';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { LeaderboardTabs } from '@/components/leaderboard-tabs';

export const revalidate = 60; // Revalidate the leaderboard every 60 seconds

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('leaderboardTitle'),
    description: t('leaderboardDescription'),
  };
}

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
  baseScore: number;
  bonusScore: number;
}

export default async function LeaderboardPage() {
  const t = await getTranslations('leaderboard');
  const isLoggedIn = !!cookies().get('tq_auth');

  let leaderboardData = {
    global: {
      weekly: [] as LeaderboardUser[],
      monthly: [] as LeaderboardUser[],
      alltime: [] as LeaderboardUser[],
    },
    friends: {
      weekly: [] as LeaderboardUser[],
      monthly: [] as LeaderboardUser[],
      alltime: [] as LeaderboardUser[],
    },
  };
  let fetchFailed = false;

  // Helper to safely fetch leaderboard data with a fallback
  async function safeFetchLeaderboard(path: string) {
    try {
      const res = await makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>(path);
      return res?.leaderboard ?? [];
    } catch (err) {
      console.error(`[LeaderboardPage] Failed to fetch ${path}:`, err);
      return [];
    }
  }

  try {
    const [gw, gm, ga] = await Promise.all([safeFetchLeaderboard('leaderboards/global?period=weekly'), safeFetchLeaderboard('leaderboards/global?period=monthly'), safeFetchLeaderboard('leaderboards/global?period=alltime')]);

    leaderboardData.global = { weekly: gw, monthly: gm, alltime: ga };

    if (isLoggedIn) {
      const [fw, fm, fa] = await Promise.all([safeFetchLeaderboard('leaderboards/friends?period=weekly'), safeFetchLeaderboard('leaderboards/friends?period=monthly'), safeFetchLeaderboard('leaderboards/friends?period=alltime')]);
      leaderboardData.friends = { weekly: fw, monthly: fm, alltime: fa };
    }
  } catch (error) {
    console.error('[LeaderboardPage] Unexpected error in data orchestration:', error);
    fetchFailed = true;
  }

  return (
    <>
      {fetchFailed && <ErrorNotification title={t('fetchErrorTitle')} message={t('fetchError')} />}
      <div className="min-h-screen py-20 px-6 sm:px-8 text-text selection:bg-brand-500">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-600 to-brand-600 dark:from-brand-400 dark:to-brand-400">{t('title')}</h1>
              <p className="text-text-muted mt-2 font-medium">{t('subtitle')}</p>
            </div>
          </div>

          {fetchFailed ? <ErrorNotification message={t('fetchError')} /> : <LeaderboardTabs initialData={leaderboardData} isLoggedIn={isLoggedIn} />}
        </div>
      </div>
    </>
  );
}
