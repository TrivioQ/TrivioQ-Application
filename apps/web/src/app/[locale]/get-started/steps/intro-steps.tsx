'use client';

import { useTranslations } from 'next-intl';

/** "How it works" — the same three steps as the landing page. */
export function IntroStep() {
  const t = useTranslations('getStarted');
  const tHome = useTranslations('home.howItWorks');
  const steps = [
    { icon: '📬', title: tHome('step1Title'), desc: tHome('step1Desc') },
    { icon: '🧠', title: tHome('step2Title'), desc: tHome('step2Desc') },
    { icon: '🏆', title: tHome('step3Title'), desc: tHome('step3Desc') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-text">{t('introTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('introDesc')}</p>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-bg-secondary/40 p-4">
            <span className="text-3xl" aria-hidden="true">
              {s.icon}
            </span>
            <div>
              <p className="font-bold text-text">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-text-muted mt-0.5">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SAMPLE_CORRECT_INDEX = 2;

/** A practice question so new users try the core loop before choosing settings. */
export function SampleDropStep({ choice, onChoose }: { choice: number | null; onChoose: (i: number) => void }) {
  const t = useTranslations('getStarted');
  const options = [t('sample.o1'), t('sample.o2'), t('sample.o3'), t('sample.o4')];
  const answered = choice !== null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-text">{t('sampleTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('sampleDesc')}</p>
      </div>
      <div className="rounded-2xl border border-brand-500/30 bg-bg-secondary/40 p-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">EASY · {t('sample.category')} · 10 pts</p>
        <p className="text-base font-semibold text-text">{t('sample.question')}</p>
        <div className="space-y-2">
          {options.map((o, i) => {
            const isCorrect = answered && i === SAMPLE_CORRECT_INDEX;
            const isWrong = answered && i === choice && i !== SAMPLE_CORRECT_INDEX;
            const cls = isCorrect ? 'border-success/50 bg-success/20 text-success' : isWrong ? 'border-error/50 bg-error/20 text-error' : answered ? 'border-border text-text-muted opacity-60' : 'border-border hover:bg-brand-500/15 hover:border-brand-500/40 text-text';
            return (
              <button key={o} type="button" disabled={answered} onClick={() => onChoose(i)} className={`w-full text-left rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${cls}`}>
                {isCorrect && (
                  <span aria-hidden="true" className="mr-2 font-black">
                    ✓
                  </span>
                )}
                {isWrong && (
                  <span aria-hidden="true" className="mr-2 font-black">
                    ✗
                  </span>
                )}
                {o}
              </button>
            );
          })}
        </div>
        {answered && (
          <div aria-live="polite" className="pt-1">
            <p className={`text-sm font-bold ${choice === SAMPLE_CORRECT_INDEX ? 'text-success' : 'text-error'}`}>{choice === SAMPLE_CORRECT_INDEX ? t('sampleCorrect') : t('sampleIncorrect')}</p>
            <p className="text-sm text-text-muted mt-1">{t('sample.explanation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
