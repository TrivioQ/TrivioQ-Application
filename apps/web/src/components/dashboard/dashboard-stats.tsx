'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { makeAPICallV1 } from '../../lib/api';
import { ScoreTrendChart, ScorePeriod } from './score-trend-chart';

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PREMIUM';
}

interface RecentDrop {
  id: string;
  wasCorrect: boolean | null;
  pointsAwarded: number;
  usedHint: boolean;
  hintCostDeducted: number;
  revealedAnswer: boolean;
  answeredAt: string | null;
  question: {
    questionText: string;
    difficultyLevel: 'EASY' | 'MEDIUM' | 'HARD';
    categories: { name: string }[];
  };
}

const DIFF_LABEL: Record<string, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
const DIFF_COLOR: Record<string, string> = {
  EASY: 'text-green-400 bg-green-400/10',
  MEDIUM: 'text-yellow-400 bg-yellow-400/10',
  HARD: 'text-red-400 bg-red-400/10',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className='rounded-2xl bg-white/5 border border-white/8 p-6 flex flex-col gap-1'>
      <p className='text-xs font-semibold uppercase tracking-widest text-gray-500'>{label}</p>
      <p className={`text-3xl font-extrabold tracking-tight ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className='text-xs text-gray-500 mt-0.5'>{sub}</p>}
    </div>
  );
}

export function DashboardStats() {
  const t = useTranslations('dashboard');

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: () => makeAPICallV1<UserProfile>('users/me'),
    staleTime: 30_000,
  });

  const { data: weeklyRes } = useQuery<{ history: ScorePeriod[] }>({
    queryKey: ['scoreHistory', 'weekly'],
    queryFn: () => makeAPICallV1<{ history: ScorePeriod[] }>('users/me/score-history?period=weekly'),
    staleTime: 30_000,
  });

  const { data: monthlyRes } = useQuery<{ history: ScorePeriod[] }>({
    queryKey: ['scoreHistory', 'monthly'],
    queryFn: () => makeAPICallV1<{ history: ScorePeriod[] }>('users/me/score-history?period=monthly'),
    staleTime: 30_000,
  });

  const { data: dropsRes } = useQuery<{ drops: RecentDrop[] }>({
    queryKey: ['recentDrops'],
    queryFn: () => makeAPICallV1<{ drops: RecentDrop[] }>('users/me/recent-drops'),
    staleTime: 30_000,
  });

  const weekly = weeklyRes?.history ?? [];
  const monthly = monthlyRes?.history ?? [];
  const recentDrops = dropsRes?.drops ?? [];

  const currentWeek = weekly[0] ?? null;
  const currentMonth = monthly[0] ?? null;

  const answered = recentDrops.filter((d) => d.wasCorrect !== null);
  const correct = answered.filter((d) => d.wasCorrect);
  const accuracyPct = answered.length > 0 ? Math.round((correct.length / answered.length) * 100) : null;

  return (
    <>
      {/* ── Score Cards ── */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard label={t('weeklyScore')} value={(currentWeek?.totalScore ?? 0).toLocaleString()} sub={currentWeek?.rank ? t('rankThisWeek', { rank: currentWeek.rank }) : t('noRankYet')} accent='text-indigo-400' />
        <StatCard label={t('monthlyScore')} value={(currentMonth?.totalScore ?? 0).toLocaleString()} sub={currentMonth?.rank ? t('rankThisMonth', { rank: currentMonth.rank }) : t('noRankYet')} accent='text-purple-400' />
        <StatCard label={t('allTimeScore')} value={(profile?.cumulativeScore ?? 0).toLocaleString()} sub={t('cumulativePoints')} accent='text-pink-400' />
        <StatCard label={t('currentStreak')} value={profile ? `${profile.currentStreak} 🔥` : '—'} sub={accuracyPct !== null ? t('accuracyLast10', { pct: accuracyPct }) : t('noDataYet')} />
      </div>

      {/* ── Score Trend Charts ── */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <div className='rounded-2xl bg-white/5 border border-white/8 p-6'>
          <p className='text-sm font-semibold text-gray-300 mb-1'>{t('weeklyTrendTitle')}</p>
          <p className='text-xs text-gray-500 mb-4'>{t('weeklyTrendSubtitle')}</p>
          <ScoreTrendChart data={weekly} mode='weekly' />
        </div>
        <div className='rounded-2xl bg-white/5 border border-white/8 p-6'>
          <p className='text-sm font-semibold text-gray-300 mb-1'>{t('monthlyTrendTitle')}</p>
          <p className='text-xs text-gray-500 mb-4'>{t('monthlyTrendSubtitle')}</p>
          <ScoreTrendChart data={monthly} mode='monthly' />
        </div>
      </div>

      {/* ── Recent Drops ── */}
      <div className='rounded-2xl bg-white/5 border border-white/8 overflow-hidden'>
        <div className='px-6 py-4 border-b border-white/8 flex items-center justify-between'>
          <div>
            <p className='text-sm font-semibold text-gray-200'>{t('recentQuestionsTitle')}</p>
            <p className='text-xs text-gray-500 mt-0.5'>{t('recentQuestionsSubtitle')}</p>
          </div>
          <a href='/score-history' className='text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors'>
            {t('fullHistory')}
          </a>
        </div>

        {recentDrops.length === 0 ? (
          <div className='px-6 py-12 text-center text-sm text-gray-500'>{t('noDropsYet')}</div>
        ) : (
          <div className='divide-y divide-white/5'>
            {recentDrops.map((drop) => (
              <div key={drop.id} className='px-6 py-4 flex items-start gap-4'>
                <div className='mt-0.5 shrink-0'>
                  {drop.revealedAnswer ? (
                    <span className='text-lg' title='Answer revealed'>
                      👁
                    </span>
                  ) : drop.wasCorrect ? (
                    <span className='text-lg' title='Correct'>
                      ✅
                    </span>
                  ) : (
                    <span className='text-lg' title='Incorrect'>
                      ❌
                    </span>
                  )}
                </div>

                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-gray-200 truncate'>{drop.question.questionText}</p>
                  <div className='flex flex-wrap items-center gap-2 mt-1.5'>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_COLOR[drop.question.difficultyLevel]}`}>{DIFF_LABEL[drop.question.difficultyLevel]}</span>
                    {drop.question.categories.slice(0, 2).map((c) => (
                      <span key={c.name} className='text-[11px] text-gray-500 bg-white/5 rounded-full px-2 py-0.5'>
                        {c.name}
                      </span>
                    ))}
                    {drop.usedHint && <span className='text-[11px] text-yellow-500 bg-yellow-500/10 rounded-full px-2 py-0.5'>{t('hintUsed', { pts: drop.hintCostDeducted })}</span>}
                    {drop.revealedAnswer && <span className='text-[11px] text-orange-400 bg-orange-400/10 rounded-full px-2 py-0.5'>{t('answerRevealed')}</span>}
                  </div>
                  <p className='text-[11px] text-gray-600 mt-1'>{formatDate(drop.answeredAt)}</p>
                </div>

                <div className='shrink-0 text-right'>
                  <p className={`text-sm font-bold ${drop.pointsAwarded > 0 ? 'text-indigo-400' : 'text-gray-600'}`}>
                    {drop.pointsAwarded > 0 ? `+${drop.pointsAwarded}` : '0'} {t('pts')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
