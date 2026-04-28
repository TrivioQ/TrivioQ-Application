import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { ScoreHistoryTabs } from '@/components/score-history-tabs';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'Score History | TrivioQ',
  description: 'View your weekly and monthly trivia score history on TrivioQ.',
};

interface ScorePeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string | null;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  rank: number | null;
}

export default async function ScoreHistoryPage() {
  const t = await getTranslations('scoreHistory');
  // Verify session cookie exists before attempting fetch
  const hasCookie = !!cookies().get('tq_auth');

  let weekly: ScorePeriod[] = [];
  let monthly: ScorePeriod[] = [];
  let fetchFailed = false;

  if (hasCookie) {
    try {
      const [weeklyRes, monthlyRes] = await Promise.all([makeServerAPICallV1<{ history: ScorePeriod[] }>('users/me/score-history?period=weekly'), makeServerAPICallV1<{ history: ScorePeriod[] }>('users/me/score-history?period=monthly')]);
      weekly = weeklyRes.history ?? [];
      monthly = monthlyRes.history ?? [];
    } catch (error) {
      console.error('[ScoreHistoryPage] Fetch failed:', error);
      fetchFailed = true;
    }
  }

  return (
    <div className='min-h-screen bg-gray-950 py-20 px-6 sm:px-8 text-white selection:bg-indigo-500 selection:text-white'>
      <div className='max-w-4xl mx-auto space-y-12'>
        {/* ── Header ── */}
        <div className='space-y-4'>
          <Link href='/dashboard' className='group inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors'>
            <span className='group-hover:-translate-x-1 transition-transform'>←</span> {t('backToDashboard')}
          </Link>
          <div>
            <h1 className='text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400'>{t('title')}</h1>
            <p className='mt-3 text-gray-400 text-lg'>{t('subtitle')}</p>
          </div>
        </div>

        {/* ── Scoring Guide ── */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          {[
            { label: t('easyLabel'), pts: t('easyPts'), color: 'from-green-500/10 to-green-500/5 border-green-500/20 text-green-400' },
            { label: t('mediumLabel'), pts: t('mediumPts'), color: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20 text-yellow-400' },
            { label: t('hardLabel'), pts: t('hardPts'), color: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400' },
          ].map((d) => (
            <div key={d.label} className={`rounded-2xl bg-gradient-to-br ${d.color} border p-5 text-center`}>
              <p className='text-xs uppercase tracking-widest font-bold text-gray-400 mb-1'>{t('difficultyLabel')}</p>
              <p className={`text-xl font-extrabold ${d.color.split(' ')[4]}`}>{d.label}</p>
              <p className='text-3xl font-black text-white mt-1'>{d.pts}</p>
            </div>
          ))}
        </div>

        {/* ── Bonus info callout ── */}
        <div className='rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-3'>
          <h2 className='font-bold text-indigo-300 text-lg'>{t('bonusPointsTitle')}</h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-400'>
            <div>
              <p className='font-semibold text-white mb-1'>{t('weeklyTop10')}</p>
              <p>{t('weeklyBonusDesc')}</p>
              <p className='text-xs mt-1 text-gray-500'>{t('weeklyBonusNote')}</p>
            </div>
            <div>
              <p className='font-semibold text-white mb-1'>{t('monthlyTop10')}</p>
              <p>{t('monthlyBonusDesc')}</p>
              <p className='text-xs mt-1 text-gray-500'>{t('monthlyBonusNote')}</p>
            </div>
          </div>
        </div>

        {/* ── Main table ── */}
        {!hasCookie ? (
          <div className='py-20 text-center text-gray-500'>
            <span className='text-5xl block mb-4'>🔒</span>
            <p>
              {t('signInPrompt')}{' '}
              <Link href='/login' className='text-indigo-400 hover:text-indigo-300'>
                {t('signInLink')}
              </Link>{' '}
              {t('signInSuffix')}
            </p>
          </div>
        ) : fetchFailed ? (
          <div className='py-20 text-center text-red-400'>
            <span className='text-5xl block mb-4'>⚠️</span>
            <p>{t('fetchError')}</p>
          </div>
        ) : (
          <ScoreHistoryTabs weekly={weekly} monthly={monthly} />
        )}
      </div>
    </div>
  );
}
