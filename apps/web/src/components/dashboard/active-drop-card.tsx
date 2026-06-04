'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { makeAPICallV1, APIError } from '../../lib/api';
import { useConfirm } from '../confirm-modal';

interface ActiveDrop {
  dropId: string;
  questionId: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: (string | { id: string; text: string })[];
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
  easy: 'text-green-400 bg-green-400/10 border-green-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard: 'text-red-400 bg-red-400/10 border-red-400/20',
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
      <div className="rounded-2xl bg-gray-50/50 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none border border-white dark:border-white/10 p-6 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded mb-3" />
        <div className="h-3 w-48 bg-gray-100 dark:bg-white/5 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 flex items-center justify-between">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={fetchActiveDrop} className="text-xs text-red-300 hover:text-red-200 underline">
          {commonT('retry')}
        </button>
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="rounded-2xl bg-gray-50/50 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none border border-white dark:border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200/60 dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-gray-400" />
              {t('activeDrop')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('noQuestionActive')}</p>
          </div>
          <p className="text-lg font-mono font-bold text-gray-400">--:--</p>
        </div>
        <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">⏳</span>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('noActiveQuestion')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">{t('noActiveDesc')}</p>
          <button onClick={handleOnDemand} disabled={onDemandLoading} className="mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 border border-blue-600 dark:border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm text-white dark:text-blue-300 font-medium transition-colors">
            {onDemandLoading ? t('requesting') : t('requestNextQuestion')}
          </button>
          {onDemandError && <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">{onDemandError}</p>}
        </div>
      </div>
    );
  }

  const isAnswerKnown = revealedCorrectIndex !== null;
  const timerUrgent = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="rounded-2xl bg-gray-50/50 dark:bg-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none border border-white dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200/60 dark:border-white/10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            {t('activeDrop')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-400 mt-0.5">{t('answerBeforeTimer')}</p>
        </div>

        {/* Timer */}
        <div className="text-right">
          {submitResult ? <p className="text-lg font-mono font-bold text-gray-500 dark:text-gray-600 dark:text-gray-400">--:--</p> : <p className={`text-lg font-mono font-bold tabular-nums ${isExpired ? 'text-red-400' : timerUrgent ? 'text-orange-400' : 'text-blue-500 dark:text-indigo-300'}`}>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</p>}
          {isExpired && !submitResult && (
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{t('expired')}</p>
              <button onClick={handleOnDemand} disabled={onDemandLoading} className="rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 border border-blue-600 dark:border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-[11px] text-white dark:text-blue-300 font-medium transition-colors">
                {onDemandLoading ? t('requesting') : t('requestNew')}
              </button>
              {onDemandError && <p className="text-[10px] text-amber-400 text-right max-w-[160px]">{onDemandError}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Difficulty + category badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${DIFF_COLOR[drop.difficulty]}`}>{drop.difficulty}</span>
          <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-2.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-400">{drop.category}</span>
          <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] text-blue-500 dark:text-indigo-300">
            {drop.pointsValue} {t('pts')}
          </span>
        </div>

        {/* Mystery → Reveal */}
        {!revealed ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">🎁</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('newQuestionWaiting')}</p>
            <button onClick={handleRevealQuestion} disabled={isExpired || revealQuestionLoading} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold text-gray-900 dark:text-white transition-colors">
              {revealQuestionLoading ? t('revealLoading') : t('revealQuestion')}
            </button>
          </div>
        ) : (
          <>
            {/* Question text */}
            <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{drop.questionText}</p>

            {/* Hint / Reveal Answer row */}
            {!submitResult && !isAnswerKnown && (
              <div className="flex gap-2">
                {hintText ? (
                  <div className="flex-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    <p className="text-[11px] font-bold text-yellow-400 mb-0.5">💡 Hint {hintCostDeducted != null ? `(−${hintCostDeducted} ${t('pts')})` : ''}</p>
                    <p className="text-xs text-yellow-200">{hintText}</p>
                  </div>
                ) : (
                  <button onClick={handleHint} disabled={hintLoading || isExpired || drop.usedHint} className="flex-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-yellow-400 transition-colors">
                    {drop.usedHint ? t('hintUsed') : hintLoading ? t('hintLoading') : t('hintCost', { pts: drop.hintCost })}
                  </button>
                )}
                <button onClick={handleReveal} disabled={revealLoading || isExpired || drop.revealedAnswer || isAnswerKnown} className="flex-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-purple-400 transition-colors">
                  {drop.revealedAnswer || isAnswerKnown ? t('answerRevealedBtn') : revealLoading ? t('revealLoading') : t('showAnswer')}
                </button>
              </div>
            )}

            {isAnswerKnown && !submitResult && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 text-center">{t('answerRevealedNotice')}</div>}

            {/* Answer options */}
            <div className="space-y-2">
              {drop.options.map((opt, index) => {
                const option = typeof opt === 'string' ? opt : opt.text;
                let cls = 'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-colors ';
                if (submitResult) {
                  if (index === revealedCorrectIndex) cls += 'border-green-500/50 bg-green-500/20 text-green-300';
                  else if (index === selectedOption && !submitResult.isCorrect) cls += 'border-red-500/50 bg-red-500/20 text-red-300';
                  else cls += 'border-gray-200 dark:border-white/5 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-gray-500 dark:text-gray-600 dark:text-gray-400 cursor-default';
                } else if (isAnswerKnown) {
                  cls += index === revealedCorrectIndex ? 'border-green-500/50 bg-green-500/20 text-green-300 cursor-default' : 'border-gray-200 dark:border-white/5 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-gray-500 dark:text-gray-600 dark:text-gray-400 cursor-default';
                } else if (isExpired || submitting) {
                  cls += 'border-gray-200 dark:border-white/5 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none text-gray-500 dark:text-gray-600 dark:text-gray-400 cursor-default';
                } else if (index === selectedOption) {
                  cls += 'border-indigo-500/60 bg-indigo-500/20 text-indigo-200';
                } else {
                  cls += 'border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none hover:bg-indigo-500/20 hover:border-indigo-500/40 text-gray-800 dark:text-gray-200 cursor-pointer';
                }

                return (
                  <button key={index} className={cls} disabled={isExpired || submitting || submitResult !== null || isAnswerKnown} onClick={() => setSelectedOption(index)}>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            {!submitResult && !isAnswerKnown && !isExpired && (
              <button onClick={handleSubmit} disabled={selectedOption === null || submitting} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold text-white transition-colors">
                {submitting ? t('submitting') : t('submitAnswer')}
              </button>
            )}

            {submitting && <p className="text-xs text-center text-gray-500 dark:text-gray-600 dark:text-gray-400 animate-pulse">{t('submitting')}</p>}

            {/* Result card */}
            {submitResult && (
              <div className="rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none px-5 py-4 text-center space-y-1">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{submitResult.revealedAnswer ? t('resultRevealed') : submitResult.isCorrect ? t('resultCorrect') : t('resultIncorrect')}</p>
                <p className={`text-sm font-semibold ${submitResult.pointsAwarded > 0 ? 'text-blue-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-600 dark:text-gray-400'}`}>{submitResult.pointsAwarded > 0 ? t('pointsAwarded', { pts: submitResult.pointsAwarded }) : t('zeroPoints')}</p>
                {submitResult.explanation && <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">{submitResult.explanation}</p>}
                <p className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-400 mt-2">{t('streakTotal', { streak: submitResult.newStreak, total: submitResult.newTotalScore.toLocaleString() })}</p>
                <div className="flex gap-2 mt-3 flex-wrap justify-center">
                  <button
                    onClick={() => {
                      resetState();
                      fetchActiveDrop();
                    }}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 border border-indigo-600 dark:border-indigo-500/30 px-4 py-1.5 text-xs text-white dark:text-indigo-300 font-medium transition-colors"
                  >
                    {t('checkNextDrop')}
                  </button>
                  <button onClick={handleOnDemand} disabled={onDemandLoading} className="rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 border border-blue-600 dark:border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs text-white dark:text-blue-300 font-medium transition-colors">
                    {onDemandLoading ? t('requesting') : t('requestNextQuestion')}
                  </button>
                </div>
                {onDemandError && <p className="text-xs text-amber-400 text-center mt-2">{onDemandError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
