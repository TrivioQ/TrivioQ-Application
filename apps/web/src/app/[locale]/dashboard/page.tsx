import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  onboardingComplete: boolean;
}

export default async function WebDashboard() {
  const t = await getTranslations('dashboard');
  const hasCookie = !!cookies().get('tq_auth');

  if (!hasCookie) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-text">
        <div className="text-center space-y-4">
          <span className="text-6xl block">🔒</span>
          <p className="text-text-muted">
            {t('signInPrompt')}{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-400 dark:hover:text-brand-300">
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

  // Gate: an unfinished-onboarding user typing /dashboard directly must be sent to wizard.
  if (profile && profile.onboardingComplete === false) {
    redirect('/get-started');
  }

  return (
    <div className="min-h-screen text-text selection:bg-brand-500 dark:selection:bg-brand-500 selection:text-text">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24 space-y-10">
        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-brand-500 dark:from-brand-400 dark:via-brand-400 dark:to-brand-400">{profile ? t('greeting', { name: profile.displayName ?? profile.username }) : t('title')}</h1>
          <p className="text-text-muted mt-2">{t('performanceSubtitle')}</p>
        </div>

        {/* ── Active Drop ── */}
        <ActiveDropCard />

        {/* ── Stats, Charts, Recent Drops ── */}
        <DashboardStats />

        {/* ── Quick links ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/score-history" className="rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 px-4 py-2 text-sm text-white dark:text-brand-300 font-medium transition-colors">
            {t('fullScoreHistory')}
          </Link>
          <Link href="/leaderboard" className="rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 px-4 py-2 text-sm text-white dark:text-brand-300 font-medium transition-colors">
            {t('leaderboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
