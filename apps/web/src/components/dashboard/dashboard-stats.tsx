'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { makeAPICallV1 } from '../../lib/api';
import { ScoreTrendChart, ScorePeriod } from './score-trend-chart';
import { Flame, Eye, CheckCircle2, XCircle } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PREMIUM';
}

interface DropChoice {
  id: string;
  text: string;
  order: number;
  isCorrect: boolean;
}

interface RecentDrop {
  id: string;
  wasCorrect: boolean | null;
  pointsAwarded: number;
  usedHint: boolean;
  hintCostDeducted: number;
  revealedAnswer: boolean;
  selectedChoiceId: string | null;
  answeredAt: string | null;
  question: {
    questionText: string;
    difficultyLevel: 'EASY' | 'MEDIUM' | 'HARD';
    categories: { name: string }[];
    choices: DropChoice[];
  };
}

const DIFF_COLOR: Record<string, string> = {
  EASY: 'text-success bg-success/10',
  MEDIUM: 'text-brand-400 bg-brand-400/10',
  HARD: 'text-error bg-error/10',
};

function formatDate(iso: string | null, locale: string, fallback: string) {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 p-4 sm:p-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 min-w-0 break-words ${accent ?? 'text-text'}`}>{value}</div>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardStats() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t('weeklyScore')} value={(currentWeek?.totalScore ?? 0).toLocaleString()} sub={currentWeek?.rank ? t('rankThisWeek', { rank: currentWeek.rank }) : t('noRankYet')} />
        <StatCard label={t('monthlyScore')} value={(currentMonth?.totalScore ?? 0).toLocaleString()} sub={currentMonth?.rank ? t('rankThisMonth', { rank: currentMonth.rank }) : t('noRankYet')} />
        <StatCard label={t('allTimeScore')} value={(profile?.cumulativeScore ?? 0).toLocaleString()} sub={t('cumulativePoints')} />
        <StatCard
          label={t('currentStreak')}
          value={
            profile ? (
              <>
                {profile.currentStreak} <Flame className="w-7 h-7 text-brand-500" />
              </>
            ) : (
              tc('dashPlaceholder')
            )
          }
          sub={accuracyPct !== null ? t('accuracyLast10', { pct: accuracyPct }) : t('noDataYet')}
        />
      </div>

      {/* ── Score Trend Charts ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 p-4 sm:p-6">
          <p className="text-sm font-semibold text-text mb-1">{t('weeklyTrendTitle')}</p>
          <p className="text-xs text-text-muted mb-4">{t('weeklyTrendSubtitle')}</p>
          <ScoreTrendChart data={weekly} mode="weekly" namespace="dashboard" />
        </div>
        <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 p-4 sm:p-6">
          <p className="text-sm font-semibold text-text mb-1">{t('monthlyTrendTitle')}</p>
          <p className="text-xs text-text-muted mb-4">{t('monthlyTrendSubtitle')}</p>
          <ScoreTrendChart data={monthly} mode="monthly" namespace="dashboard" />
        </div>
      </div>

      {/* ── Recent Drops ── */}
      <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border dark:border-white/10 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text">{t('recentQuestionsTitle')}</p>
            <p className="text-xs text-text-muted mt-0.5">{t('recentQuestionsSubtitle')}</p>
          </div>
          <a href="/score-history" className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
            {t('fullHistory')}
          </a>
        </div>

        {recentDrops.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">{t('noDropsYet')}</div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentDrops.map((drop) => {
              const selectedText = drop.selectedChoiceId != null ? (drop.question.choices.find((c) => c.id === drop.selectedChoiceId)?.text ?? tc('dashPlaceholder')) : null;
              const correctText = drop.question.choices.find((c) => c.isCorrect)?.text ?? tc('dashPlaceholder');

              return (
                <div key={drop.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 shrink-0 flex items-center justify-center">
                    {drop.revealedAnswer ? (
                      <span title={t('answerRevealed')}>
                        <Eye className="w-5 h-5 text-text-muted" />
                      </span>
                    ) : drop.wasCorrect ? (
                      <span title={t('resultCorrectTitle')}>
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      </span>
                    ) : (
                      <span title={t('resultIncorrectTitle')}>
                        <XCircle className="w-5 h-5 text-error" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{drop.question.questionText}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_COLOR[drop.question.difficultyLevel]}`}>{t(`diffLabels.${drop.question.difficultyLevel}`)}</span>
                      {drop.question.categories.slice(0, 2).map((c) => (
                        <span key={c.name} className="text-[11px] text-text-muted bg-text-muted/10 dark:bg-white/5 rounded-full px-2 py-0.5">
                          {c.name}
                        </span>
                      ))}
                      {drop.usedHint && <span className="text-[11px] text-brand-500 bg-brand-500/10 rounded-full px-2 py-0.5">{t('hintUsed', { pts: drop.hintCostDeducted })}</span>}
                      {drop.revealedAnswer && <span className="text-[11px] text-brand-400 bg-brand-400/10 rounded-full px-2 py-0.5">{t('answerRevealed')}</span>}
                    </div>
                    {selectedText != null && (
                      <div className="mt-2 space-y-0.5">
                        <p className="text-[11px]">
                          <span className="text-text-muted">{t('yourAnswer')} </span>
                          <span className={drop.wasCorrect ? 'text-success' : 'text-error'}>{selectedText}</span>
                        </p>
                        {!drop.wasCorrect && (
                          <p className="text-[11px]">
                            <span className="text-text-muted">{t('correctAnswer')} </span>
                            <span className="text-success">{correctText}</span>
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-text-muted mt-1">{formatDate(drop.answeredAt, locale, tc('dashPlaceholder'))}</p>
                  </div>

                  <div className="shrink-0 sm:text-right self-end sm:self-auto">
                    <p className={`text-sm font-bold ${drop.pointsAwarded > 0 ? 'text-brand-400' : 'text-text-muted'}`}>
                      {drop.pointsAwarded > 0 ? `+${drop.pointsAwarded}` : '0'} {t('pts')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
