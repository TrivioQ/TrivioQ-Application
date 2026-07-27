'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { makeAPICallV1 } from '@/lib/api';

export function TrialStep() {
  const t = useTranslations('getStarted');
  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: () => makeAPICallV1<{ maxDropsPremium?: number; maxDropsFree?: number }>('info'),
    staleTime: 60_000 * 60,
  });

  const maxDropsPremium = info?.maxDropsPremium ?? 100;
  const maxDropsFree = info?.maxDropsFree ?? 25;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">{t('step2Title')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('step2Desc', { maxDrops: maxDropsPremium })}</p>
      </div>

      <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-brand-700/5 p-6 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-text">7</span>
          <span className="text-sm text-text-muted">days free, then subscribe to continue Premium.</span>
        </div>
        <ul className="text-sm text-text-muted space-y-1.5 list-disc pl-5">
          <li>
            Up to {maxDropsPremium} daily drops instead of {maxDropsFree}
          </li>
          <li>On-demand drops at any time</li>
          <li>No payment details required now</li>
        </ul>
      </div>
    </div>
  );
}
