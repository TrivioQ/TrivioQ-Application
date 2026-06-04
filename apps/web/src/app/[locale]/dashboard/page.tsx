import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { makeServerAPICallV1 } from '@/lib/api-server';
import ActiveDropCard from '@/components/dashboard/active-drop-card';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('dashboardTitle'),
    description: t('dashboardDescription'),
  };
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PREMIUM';
}

export default async function WebDashboard() {
  const t = await getTranslations('dashboard');
  const hasCookie = !!cookies().get('tq_auth');

  if (!hasCookie) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-gray-900 dark:text-white">
        <div className="text-center space-y-4">
          <span className="text-6xl block">🔒</span>
          <p className="text-gray-500 dark:text-gray-400">
            {t('signInPrompt')}{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              {t('signInLink')}
            </Link>{' '}
            {t('signInSuffix')}
          </p>
        </div>
      </div>
    );
  }

  let profile: UserProfile | null = null;
  try {
    profile = await makeServerAPICallV1<UserProfile>('users/me');
  } catch (err) {
    console.error('[WebDashboard] Fetch failed:', err);
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-white selection:bg-blue-500 dark:selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-6 py-24 space-y-10">
        {/* ── Header ── */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">{profile ? t('greeting', { name: profile.displayName ?? profile.username }) : t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('performanceSubtitle')}</p>
        </div>

        {/* ── Active Drop ── */}
        <ActiveDropCard />

        {/* ── Stats, Charts, Recent Drops ── */}
        <DashboardStats />

        {/* ── Quick links ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/score-history" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 border border-indigo-600 dark:border-indigo-500/30 px-4 py-2 text-sm text-white dark:text-indigo-300 font-medium transition-colors">
            {t('fullScoreHistory')}
          </Link>
          <Link href="/leaderboard" className="rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 border border-blue-600 dark:border-blue-500/30 px-4 py-2 text-sm text-white dark:text-blue-300 font-medium transition-colors">
            {t('leaderboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
