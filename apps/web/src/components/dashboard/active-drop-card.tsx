'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { makeAPICallV1, APIError } from '../../lib/api';
import { useConfirm } from '../confirm-modal';
import { Hourglass, Gift, Lightbulb } from 'lucide-react';
import { MarkdownContent } from '../markdown-content';

interface ActiveDrop {
  dropId: string;
  questionId: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: { id: string; text: string }[];
  expiresAt: number;
  answerDeadline: number | null;
  pointsValue: number;
  hintCost: number;
  usedHint: boolean;
  revealedAnswer: boolean;
}

interface SubmitResult {
  isCorrect: boolean;
  correctOptionIndex: number | null;
  pointsAwarded: number;
  revealedAnswer: boolean;
  explanation?: string;
  newStreak: number;
  newTotalScore: number;
}

const DIFF_COLOR: Record<string, string> = {
  easy: 'text-success bg-success/10 border-success/20',
  medium: 'text-brand-400 bg-brand-400/10 border-brand-400/20',
  hard: 'text-error bg-error/10 border-error/20',
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ActiveDropCard() {
  const t = useTranslations('activeDrop');
  const commonT = useTranslations('common');
  const queryClient = useQueryClient();
  const [drop, setDrop] = useState<ActiveDrop | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [hintText, setHintText] = useState<string | null>(null);
  const [hintCostDeducted, setHintCostDeducted] = useState<number | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const [revealedCorrectIndex, setRevealedCorrectIndex] = useState<number | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [onDemandLoading, setOnDemandLoading] = useState(false);
  const [onDemandError, setOnDemandError] = useState<string | null>(null);

  const confirm = useConfirm();

  const handleOnDemand = async () => {
    setOnDemandLoading(true);
    setOnDemandError(null);
    try {
      await makeAPICallV1('drops/on-demand', { method: 'POST' });
      resetState();
      fetchActiveDrop();
    } catch (err) {
      const msg = err instanceof APIError ? err.message : t('failedOnDemand');
      setOnDemandError(msg);
    } finally {
      setOnDemandLoading(false);
    }
  };

  const fetchActiveDrop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeAPICallV1<ActiveDrop>('drops/active');
      setDrop(data || null);
      if (data?.usedHint) setHintText(t('hintAlreadyUsed'));
    } catch (err) {
      if (err instanceof APIError && err.status === 404) {
        setDrop(null);
      } else {
        setError(t('failedLoadDrop'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchActiveDrop();
  }, [fetchActiveDrop]);

  useEffect(() => {
    if (drop?.answerDeadline) setRevealed(true);
  }, [drop?.answerDeadline]);

  // Use answerDeadline if the question has been revealed (server-enforced
  // per-difficulty timer), otherwise fall back to the overall drop expiration.
  const effectiveDeadline: number | null = drop?.answerDeadline ?? drop?.expiresAt ?? null;

  useEffect(() => {
    if (!effectiveDeadline || submitResult) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((effectiveDeadline - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) setIsExpired(true);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [effectiveDeadline, submitResult]);

  const handleSubmit = async () => {
    if (!drop || isExpired || submitting || submitResult || selectedOption === null) return;
    setSubmitting(true);
    try {
      const result = await makeAPICallV1<SubmitResult>(`drops/${drop.dropId}/submit`, {
        method: 'POST',
        body: { selectedOptionIndex: selectedOption },
      });
      setSubmitResult(result);
      if (result.correctOptionIndex !== null) {
        setRevealedCorrectIndex(result.correctOptionIndex);
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['scoreHistory'] });
      queryClient.invalidateQueries({ queryKey: ['recentDrops'] });
    } catch {
      setError(t('failedSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!drop || hintText || hintLoading || isExpired || drop.usedHint) return;
    const ok = await confirm({
      title: t('hintLabel', { cost: drop.hintCost }),
      message: t('hintConfirm', { cost: drop.hintCost }),
    });
    if (!ok) return;
    setHintLoading(true);
    try {
      const result = await makeAPICallV1<{ hintText: string; hintCost: number }>(`drops/${drop.dropId}/hint`, { method: 'POST' });
      setHintText(result.hintText);
      setHintCostDeducted(result.hintCost);
    } catch (err) {
      const msg = err instanceof APIError ? err.message : t('failedHint');
      setError(msg);
    } finally {
      setHintLoading(false);
    }
  };

  const [revealQuestionLoading, setRevealQuestionLoading] = useState(false);

  const handleRevealQuestion = async () => {
    if (!drop || revealQuestionLoading || isExpired) return;
    setRevealQuestionLoading(true);
    try {
      const result = await makeAPICallV1<{ answerDeadline: number }>(`drops/${drop.dropId}/reveal-question`, { method: 'POST' });
      setRevealed(true);
      // Start the per-difficulty countdown immediately
      if (result.answerDeadline) {
        const diff = Math.max(0, Math.floor((result.answerDeadline - Date.now()) / 1000));
        setTimeLeft(diff);
        if (diff === 0) setIsExpired(true);
      }
      fetchActiveDrop(); // refresh so subsequent renders see server state
    } catch (err) {
      const msg = err instanceof APIError ? err.message : t('failedReveal');
      setError(msg);
    } finally {
      setRevealQuestionLoading(false);
    }
  };

  const handleReveal = async () => {
    if (!drop || revealedCorrectIndex !== null || revealLoading || submitResult) return;
    const ok = await confirm({
      title: t('showAnswer'),
      message: t('revealConfirm'),
      isDestructive: true,
    });
    if (!ok) return;
    setRevealLoading(true);
    try {
      const result = await makeAPICallV1<{ correctOptionIndex: number }>(`drops/${drop.dropId}/reveal-answer`, { method: 'POST' });
      setRevealedCorrectIndex(result.correctOptionIndex);
    } catch (err) {
      const msg = err instanceof APIError ? err.message : t('failedReveal');
      setError(msg);
    } finally {
      setRevealLoading(false);
    }
  };

  const resetState = () => {
    setRevealed(false);
    setTimeLeft(null);
    setIsExpired(false);
    setSelectedOption(null);
    setSubmitResult(null);
    setHintText(null);
    setHintCostDeducted(null);
    setRevealedCorrectIndex(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 p-6 animate-pulse">
        <div className="h-4 w-32 bg-text-muted/20 dark:bg-white/10 rounded mb-3" />
        <div className="h-3 w-48 bg-text-muted/10 dark:bg-white/5 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-error/10 border border-error/20 p-4 sm:p-6 flex items-center justify-between">
        <p className="text-sm text-error">{error}</p>
        <button onClick={fetchActiveDrop} className="text-xs text-error/80 hover:text-error underline">
          {commonT('retry')}
        </button>
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border dark:border-white/10 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-muted flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-text-muted/60" />
              {t('activeDrop')}
            </p>
            <p className="text-xs text-text-muted mt-0.5">{t('noQuestionActive')}</p>
          </div>
          <p className="text-lg font-mono font-bold text-text-muted">--:--</p>
        </div>
        <div className="px-4 sm:px-6 py-8 flex flex-col items-center gap-3 text-center">
          <Hourglass className="w-10 h-10 text-text-muted" />
          <p className="text-sm font-semibold text-text">{t('noActiveQuestion')}</p>
          <p className="text-xs text-text-muted max-w-xs leading-relaxed">{t('noActiveDesc')}</p>
          <button onClick={handleOnDemand} disabled={onDemandLoading} className="mt-2 rounded-xl bg-brand-600 hover:bg-brand-700 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm text-white dark:text-brand-300 font-medium transition-colors">
            {onDemandLoading ? t('requesting') : t('requestNextQuestion')}
          </button>
          {onDemandError && <p className="text-xs text-warning mt-1">{onDemandError}</p>}
        </div>
      </div>
    );
  }

  const isAnswerKnown = revealedCorrectIndex !== null;
  const timerUrgent = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="rounded-2xl bg-bg/70 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none border border-brand-100 dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border dark:border-white/10 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
            {t('activeDrop')}
          </p>
          <p className="text-xs text-text-muted mt-0.5">{t('answerBeforeTimer')}</p>
        </div>

        {/* Timer */}
        <div className="text-right">
          {submitResult ? <p className="text-lg font-mono font-bold text-text-muted">--:--</p> : <p className={`text-lg font-mono font-bold tabular-nums ${isExpired ? 'text-error' : timerUrgent ? 'text-warning' : 'text-brand-300'}`}>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</p>}
          {isExpired && !submitResult && (
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] font-bold text-error uppercase tracking-widest">{t('expired')}</p>
              <button onClick={handleOnDemand} disabled={onDemandLoading} className="rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-[11px] text-white dark:text-brand-300 font-medium transition-colors">
                {onDemandLoading ? t('requesting') : t('requestNew')}
              </button>
              {onDemandError && <p className="text-[10px] text-warning text-right max-w-[160px]">{onDemandError}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-4">
        {/* Difficulty + category badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${DIFF_COLOR[drop.difficulty]}`}>{drop.difficulty}</span>
          <span className="inline-flex items-center rounded-full border border-text-muted/40 dark:border-white/10 bg-text-muted/10 dark:bg-white/5 px-2.5 py-0.5 text-[11px] text-text-muted">{drop.category}</span>
          <span className="inline-flex items-center rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-0.5 text-[11px] text-brand-300">
            {drop.pointsValue} {t('pts')}
          </span>
        </div>

        {/* Mystery → Reveal */}
        {!revealed ? (
          <div className="text-center py-4 flex flex-col items-center">
            <Gift className="w-10 h-10 mb-3 text-brand-400" />
            <p className="text-sm text-text-muted mb-4">{t('newQuestionWaiting')}</p>
            <button onClick={handleRevealQuestion} disabled={isExpired || revealQuestionLoading} className="rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold text-white transition-colors">
              {revealQuestionLoading ? t('revealLoading') : t('revealQuestion')}
            </button>
          </div>
        ) : (
          <>
            {/* Question text */}
            <div className="text-base font-semibold text-text leading-snug">
              <MarkdownContent>{drop.questionText}</MarkdownContent>
            </div>

            {/* Hint / Reveal Answer row */}
            {!submitResult && !isAnswerKnown && (
              <div className="flex gap-2">
                {hintText ? (
                  <div className="flex-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2">
                    <p className="text-[11px] font-bold text-brand-400 mb-0.5 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Hint {hintCostDeducted != null ? `(−${hintCostDeducted} ${t('pts')})` : ''}
                    </p>
                    <div className="text-xs text-brand-200">
                      <MarkdownContent>{hintText}</MarkdownContent>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleHint} disabled={hintLoading || isExpired || drop.usedHint} className="flex-1 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-brand-400 transition-colors">
                    {drop.usedHint ? t('hintUsed') : hintLoading ? t('hintLoading') : t('hintCost', { pts: drop.hintCost })}
                  </button>
                )}
                <button onClick={handleReveal} disabled={revealLoading || isExpired || drop.revealedAnswer || isAnswerKnown} className="flex-1 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-brand-400 transition-colors">
                  {drop.revealedAnswer || isAnswerKnown ? t('answerRevealedBtn') : revealLoading ? t('revealLoading') : t('showAnswer')}
                </button>
              </div>
            )}

            {isAnswerKnown && !submitResult && <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error text-center">{t('answerRevealedNotice')}</div>}

            {/* Answer options */}
            <div className="space-y-2">
              {drop.options.map((opt, index) => {
                const option = opt.text;
                let cls = 'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-colors ';
                if (submitResult) {
                  if (index === revealedCorrectIndex) cls += 'border-success/50 bg-success/20 text-success';
                  else if (index === selectedOption && !submitResult.isCorrect) cls += 'border-error/50 bg-error/20 text-error';
                  else cls += 'border-border dark:border-white/5 bg-bg-secondary/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-text-muted cursor-default';
                } else if (isAnswerKnown) {
                  cls += index === revealedCorrectIndex ? 'border-success/50 bg-success/20 text-success cursor-default' : 'border-border dark:border-white/5 bg-bg-secondary/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-text-muted cursor-default';
                } else if (isExpired || submitting) {
                  cls += 'border-border dark:border-white/5 bg-bg-secondary/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-text-muted cursor-default';
                } else if (index === selectedOption) {
                  cls += 'border-brand-500/60 bg-brand-500/20 text-brand-200';
                } else {
                  cls += 'border-border dark:border-white/10 bg-bg-secondary/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none hover:bg-brand-500/20 hover:border-brand-500/40 text-text cursor-pointer';
                }

                return (
                  <button key={opt.id} className={cls} disabled={isExpired || submitting || submitResult !== null || isAnswerKnown} onClick={() => setSelectedOption(index)}>
                    <MarkdownContent inline>{option}</MarkdownContent>
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            {!submitResult && !isAnswerKnown && !isExpired && (
              <button onClick={handleSubmit} disabled={selectedOption === null || submitting} className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:text-text-muted disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold text-white transition-colors">
                {submitting ? t('submitting') : t('submitAnswer')}
              </button>
            )}

            {submitting && <p className="text-xs text-center text-text-muted animate-pulse">{t('submitting')}</p>}

            {/* Result card */}
            {submitResult && (
              <div className="rounded-xl border border-border dark:border-white/10 bg-bg-secondary/50 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none px-5 py-4 text-center space-y-1">
                <p className="text-lg font-bold text-text">{submitResult.revealedAnswer ? t('resultRevealed') : submitResult.isCorrect ? t('resultCorrect') : t('resultIncorrect')}</p>
                <p className={`text-sm font-semibold ${submitResult.pointsAwarded > 0 ? 'text-brand-400' : 'text-text-muted'}`}>{submitResult.pointsAwarded > 0 ? t('pointsAwarded', { pts: submitResult.pointsAwarded }) : t('zeroPoints')}</p>
                {submitResult.explanation && (
                  <div className="text-xs text-text-muted italic mt-1">
                    <MarkdownContent>{submitResult.explanation}</MarkdownContent>
                  </div>
                )}
                <p className="text-xs text-text-muted mt-2">{t('streakTotal', { streak: submitResult.newStreak, total: submitResult.newTotalScore.toLocaleString() })}</p>
                <div className="flex gap-2 mt-3 flex-wrap justify-center">
                  <button
                    onClick={() => {
                      resetState();
                      fetchActiveDrop();
                    }}
                    className="rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 px-4 py-1.5 text-xs text-white dark:text-brand-300 font-medium transition-colors"
                  >
                    {t('checkNextDrop')}
                  </button>
                  <button onClick={handleOnDemand} disabled={onDemandLoading} className="rounded-xl bg-brand-600 hover:bg-brand-700 dark:bg-brand-600/20 dark:hover:bg-brand-600/30 border border-brand-600 dark:border-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs text-white dark:text-brand-300 font-medium transition-colors">
                    {onDemandLoading ? t('requesting') : t('requestNextQuestion')}
                  </button>
                </div>
                {onDemandError && <p className="text-xs text-warning text-center mt-2">{onDemandError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
