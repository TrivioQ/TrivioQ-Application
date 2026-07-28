'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { makeAPICallV1 } from '@/lib/api';
import { CategoriesStep } from './steps/categories-step';
import { TrialStep } from './steps/trial-step';
import { ActiveTimeStep } from './steps/active-time-step';

const STEP_LABELS = ['Categories', 'Trial', 'Active time', 'Finish'] as const;
const TOTAL_STEPS = STEP_LABELS.length;
const ROTATION_INTERVAL_MS = 2800;

export function GetStartedWizard() {
  const router = useRouter();
  const t = useTranslations('getStarted');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeStart, setActiveStart] = useState<string>('09:00');
  const [activeEnd, setActiveEnd] = useState<string>('17:00');
  const [trialAccepted, setTrialAccepted] = useState(false);

  const loadingMessages = useMemo(() => [t('step4LoadingMsg1'), t('step4LoadingMsg2'), t('step4LoadingMsg3'), t('step4LoadingMsg4'), t('step4LoadingMsg5')], [t]);

  const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);

  useEffect(() => {
    if (!submitting) {
      setLoadingMessageIdx(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingMessageIdx((i) => (i + 1) % loadingMessages.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [submitting, loadingMessages.length]);

  function canAdvance(): { ok: boolean; reason?: string } {
    if (step === 1) {
      if (selectedCategories.length < 30) return { ok: false, reason: t('step1MinError') };
    }
    if (step === 2) {
      if (!trialAccepted) return { ok: false, reason: 'Trial acceptance is required.' };
    }
    if (step === 3) {
      if (!isValidTime(activeStart) || !isValidTime(activeEnd)) {
        return { ok: false, reason: 'Times invalid.' };
      }
    }
    return { ok: true };
  }

  async function submit() {
    setSubmitting(true);
    try {
      await makeAPICallV1('onboarding/complete', {
        method: 'POST',
        body: {
          categoryNames: selectedCategories,
          activeWindowStart: activeStart,
          activeWindowEnd: activeEnd,
          acceptTrial: true,
        },
      });
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || t('submitFailed'));
      setSubmitting(false);
    }
  }

  async function next() {
    const check = canAdvance();
    if (!check.ok) {
      toast.error(check.reason || t('step1MinError'));
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    await submit();
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  const advanceLabel = useMemo(() => {
    if (step === 1) return t('step1Continue');
    if (step === 2) return t('step2Cta');
    if (step === 3) return t('step3Continue');
    return t('step4Submit');
  }, [step, t]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl bg-bg-secondary/70 backdrop-blur-2xl rounded-3xl border border-brand-100 dark:border-white/10 shadow-2xl shadow-brand-500/15 p-8 sm:p-10 space-y-8">
        {/* Progress */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-brand-500">{t('title')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('subtitle')}</p>
          <div className="mt-6 flex items-center gap-2">
            {STEP_LABELS.map((label, idx) => {
              const n = idx + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={label} className="flex-1 flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-success text-text' : active ? 'bg-brand-600 text-text' : 'bg-overlay text-text-muted'}`}>{n}</div>
                  {idx < STEP_LABELS.length - 1 && <div className={`flex-1 h-0.5 ${n < step ? 'bg-success' : 'bg-overlay'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step body */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {step === 1 && <CategoriesStep selected={selectedCategories} onChange={setSelectedCategories} initialNames={[]} />}
            {step === 2 && (
              <div className="space-y-6">
                <TrialStep />
                <label className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-bg-secondary/40 cursor-pointer">
                  <input type="checkbox" checked={trialAccepted} onChange={(e) => setTrialAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-bg-secondary text-brand-600 dark:text-brand-500 focus:ring-brand-600 dark:focus:ring-brand-500 cursor-pointer" />
                  <span className="text-sm text-text">I accept the 7-day Premium free trial. I understand no payment is required and I can subscribe later.</span>
                </label>
              </div>
            )}
            {step === 3 && <ActiveTimeStep start={activeStart} end={activeEnd} onChangeStart={setActiveStart} onChangeEnd={setActiveEnd} />}
            {step === 4 && !submitting && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-text">{t('step4Title')}</h2>
                <p className="text-sm text-text-muted mt-1">{t('step4Desc')}</p>
                <ul className="text-sm text-text-muted space-y-1 list-disc pl-5">
                  <li>{selectedCategories.length} categories selected</li>
                  <li>
                    Active window {activeStart}–{activeEnd}
                  </li>
                  <li>7-day Premium trial activated</li>
                </ul>
              </div>
            )}
            {step === 4 && submitting && (
              <div className="py-8 flex flex-col items-center text-center space-y-6" role="status" aria-live="polite">
                <div className="relative h-16 w-16">
                  <Loader2 className="absolute inset-0 h-16 w-16 text-brand-500 animate-spin" aria-hidden="true" />
                </div>
                <div className="min-h-[3rem]">
                  <AnimatePresence mode="wait">
                    <motion.p key={loadingMessageIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="text-sm font-medium text-text">
                      {loadingMessages[loadingMessageIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-xs text-text-muted">{t('step4LoadingHint')}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer nav */}
        {!submitting && (
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={back} disabled={step === 1} className="px-5 py-2.5 rounded-xl text-sm font-bold text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed">
              Back
            </button>
            <button type="button" onClick={next} className="bg-brand-600 hover:bg-brand-500 text-text px-6 py-2.5 rounded-xl text-sm font-bold transition-all">
              {advanceLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}
