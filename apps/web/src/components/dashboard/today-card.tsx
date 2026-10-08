'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Flame } from 'lucide-react';
import { formatUntil, useToday } from '@/lib/queries';

function ProgressRing({ value, max, label, sublabel }: { value: number; max: number; label: string; sublabel: string }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={`${label} ${sublabel}`} className="relative h-24 w-24 shrink-0">
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-text-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - fraction)} className={`transition-all duration-700 ${fraction >= 1 ? 'stroke-success' : 'stroke-brand-500'}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold text-text">{label}</span>
        <span className="text-[10px] text-text-muted">{sublabel}</span>
      </div>
    </div>
  );
}

/** Daily progress ring, "streak at risk" warning and next-drop countdown. */
export function TodayCard() {
  const t = useTranslations('dashboard');
  const { data: today, isLoading } = useToday();

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-bg/70 dark:bg-white/5 border border-brand-100 dark:border-white/10 animate-pulse" aria-busy="true" />;
  }
  if (!today) return null;

  const total = Math.max(today.receivedToday, today.answeredToday);
  const windowOpen = new Date(today.windowEnd).getTime() > Date.now();

  return (
    <div className="space-y-3">
      {today.streakAtRisk && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <Flame className="h-7 w-7 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-text">{t('streakAtRiskTitle', { count: today.currentStreak })}</p>
            <p className="text-xs text-text-muted">{windowOpen ? t('streakAtRiskBody', { until: formatUntil(today.windowEnd, t) }) : t('streakAtRiskBodyLate')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-5 rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 p-4 sm:p-6">
        <ProgressRing value={today.answeredToday} max={Math.max(total, 1)} label={`${today.answeredToday}/${total}`} sublabel={t('answered')} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-bold text-text">{t('todayTitle')}</p>
          <p className="text-sm text-text-muted">{t('todayAnswered', { answered: today.answeredToday, received: today.receivedToday })}</p>
          <p className="text-sm text-text-muted">{today.nextDropAt ? t('nextDropAt', { when: formatUntil(today.nextDropAt, t) }) : t('noMoreDropsToday')}</p>
        </div>
        <Link href="/review" className="hidden sm:inline-flex shrink-0 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-xs font-semibold text-brand-500 dark:text-brand-300 hover:bg-brand-500/20 transition-colors">
          🧠 {t('reviewMistakes')}
        </Link>
      </div>
    </div>
  );
}
