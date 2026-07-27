'use client';

import { useTranslations } from 'next-intl';

interface ActiveTimeStepProps {
  start: string;
  end: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
}

const inputClass = 'w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-brand-500';

export function ActiveTimeStep({ start, end, onChangeStart, onChangeEnd }: ActiveTimeStepProps) {
  const t = useTranslations('getStarted');

  // Basic HH:MM validation; allow equal times (treated as no-restriction)
  const valid = /^[01]\d|2[0-3]:[0-5]\d$/.test(start) && validTime(end);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-text">{t('step3Title')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('step3Desc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('step3StartLabel')}</label>
          <input type="time" value={start} onChange={(e) => onChangeStart(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('step3EndLabel')}</label>
          <input type="time" value={end} onChange={(e) => onChangeEnd(e.target.value)} className={inputClass} />
        </div>
      </div>

      {!valid && <p className="text-error text-sm">Please enter both times in HH:MM 24-hour format.</p>}
    </div>
  );
}

function validTime(s: string): boolean {
  return /^[01]\d|2[0-3]:[0-5]\d$/.test(s);
}
