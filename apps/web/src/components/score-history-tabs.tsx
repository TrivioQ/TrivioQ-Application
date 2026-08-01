'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

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

interface ScoreHistoryTabsProps {
  weekly: ScorePeriod[];
  monthly: ScorePeriod[];
}

function formatPeriodLabel(period: ScorePeriod, locale: string): string {
  const start = new Date(period.periodStart);
  if (period.periodType === 'WEEKLY') {
    const end = period.periodEnd ? new Date(period.periodEnd) : null;
    const s = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const e = end ? end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `${s} – ${e}`;
  }
  return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function RankBadge({ rank, fallback }: { rank: number | null; fallback: string }) {
  if (!rank) return <span className="text-text-muted text-sm">{fallback}</span>;
  const colors: Record<number, string> = {
    1: 'bg-brand-500/20 text-brand-300 border-brand-500/40',
    2: 'bg-text-muted/20 text-text-muted border-text-muted/40',
    3: 'bg-warning/20 text-warning border-warning/40',
  };
  const cls = colors[rank] ?? 'bg-brand-500/10 text-brand-300 border-brand-500/20';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>;
}

function HistoryTable({ data, t, locale, fallback }: { data: ScorePeriod[]; t: ReturnType<typeof useTranslations<'scoreHistory'>>; locale: string; fallback: string }) {
  if (data.length === 0) {
    return (
      <div className="py-20 text-center text-text-muted">
        <span className="text-5xl block mb-4">📭</span>
        <p>{t('noDataYet')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-2xl border border-white/10">
      <table className="w-full min-w-[480px] text-left">
        <thead className="bg-brand-50/40 text-xs uppercase tracking-widest text-text-muted backdrop-blur-xl">
          <tr>
            <th className="px-4 sm:px-6 py-4">{t('periodHeader')}</th>
            <th className="px-4 sm:px-6 py-4 text-right">{t('triviaScoreHeader')}</th>
            <th className="hidden md:table-cell px-4 sm:px-6 py-4 text-right">{t('bonusHeader')}</th>
            <th className="px-4 sm:px-6 py-4 text-right">{t('totalHeader')}</th>
            <th className="px-4 sm:px-6 py-4 text-right">{t('rankHeader')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-white/10 dark:hover:bg-white/[0.02] transition-colors">
              <td className="px-4 sm:px-6 py-4 text-sm text-text font-medium max-w-[140px] sm:max-w-none truncate">{formatPeriodLabel(row, locale)}</td>
              <td className="px-4 sm:px-6 py-4 text-right font-mono text-text">{row.baseScore.toLocaleString()}</td>
              <td className="hidden md:table-cell px-4 sm:px-6 py-4 text-right">{row.bonusScore > 0 ? <span className="text-success font-bold font-mono">+{row.bonusScore.toLocaleString()}</span> : <span className="text-text-muted font-mono">{fallback}</span>}</td>
              <td className="px-4 sm:px-6 py-4 text-right">
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-300">{row.totalScore.toLocaleString()}</span>
              </td>
              <td className="px-4 sm:px-6 py-4 text-right">
                <RankBadge rank={row.rank} fallback={fallback} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreHistoryTabs({ weekly, monthly }: ScoreHistoryTabsProps) {
  const t = useTranslations('scoreHistory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  return (
    <div className="space-y-6">
      <div className="flex justify-center p-1 bg-white/60 dark:bg-gray-900/50 rounded-xl border border-brand-100 dark:border-white/5 backdrop-blur-xl w-fit mx-auto shadow-xl shadow-brand-500/15 dark:shadow-none">
        {(['weekly', 'monthly'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === tab ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-text-muted hover:text-text hover:bg-white/5'}`}>
            {tab === 'weekly' ? t('weekly') : t('monthly')}
          </button>
        ))}
      </div>

      <HistoryTable data={activeTab === 'weekly' ? weekly : monthly} t={t} locale={locale} fallback={tc('dashPlaceholder')} />

      <p className="text-center text-text-muted text-xs">{t('historyNote')}</p>
    </div>
  );
}
