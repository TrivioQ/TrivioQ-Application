'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PracticeResult } from '@trivioq/shared-types';
import { api } from '@/lib/queries';
import { MarkdownContent } from '@/components/markdown-content';

/** Re-quiz past incorrect answers. No points, no stat changes. */
export function ReviewView() {
  const t = useTranslations('review');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [score, setScore] = useState(0);

  const { data: questions, isLoading, isError, refetch } = useQuery({ queryKey: ['mistakes'], queryFn: api.mistakes });

  const check = useMutation({
    mutationFn: ({ questionId, option }: { questionId: string; option: number }) => api.practice(questionId, option),
    onSuccess: (r) => {
      setResult(r);
      if (r.isCorrect) setScore((s) => s + 1);
    },
  });

  const restart = () => {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setResult(null);
    refetch();
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen text-text">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
        <div>
          <Link href="/history" className="text-sm font-semibold text-brand-500 hover:text-brand-400">
            ← {t('back')}
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
        </div>
        {children}
      </div>
    </div>
  );

  if (isLoading) return shell(<div className="h-64 rounded-2xl bg-bg/70 dark:bg-white/5 animate-pulse" aria-busy="true" />);
  if (isError) return shell(<p className="text-error">{t('error')}</p>);

  if (!questions || questions.length === 0) {
    return shell(
      <div className="py-16 text-center">
        <div className="text-5xl" aria-hidden="true">
          🎉
        </div>
        <p className="mt-3 text-lg font-bold">{t('emptyTitle')}</p>
        <p className="text-sm text-text-muted">{t('emptyBody')}</p>
      </div>,
    );
  }

  if (index >= questions.length) {
    return shell(
      <div className="py-12 text-center space-y-3">
        <div className="text-5xl" aria-hidden="true">
          🧠
        </div>
        <h2 className="text-xl font-bold">{t('doneTitle')}</h2>
        <p className="text-text-muted">{t('doneBody', { score, total: questions.length })}</p>
        <button onClick={restart} className="rounded-xl bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-sm font-bold text-white">
          {t('again')}
        </button>
      </div>,
    );
  }

  const q = questions[index];

  return shell(
    <div className="rounded-2xl bg-bg/70 dark:bg-white/5 border border-brand-100 dark:border-white/10 p-5 sm:p-6 space-y-4">
      <p className="text-xs text-text-muted" aria-live="polite">
        {t('progress', { current: index + 1, total: questions.length })} · {t('noPoints')}
      </p>
      <div className="flex gap-2 text-[11px]">
        <span className="rounded-full bg-text-muted/10 px-2 py-0.5 font-semibold uppercase text-text-muted">{q.difficulty}</span>
        <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-text-muted">{q.category}</span>
      </div>
      <div className="text-base font-semibold">
        <MarkdownContent>{q.questionText}</MarkdownContent>
      </div>
      <div className="space-y-2">
        {q.options.map((o, i) => {
          const isCorrect = result && i === result.correctOptionIndex;
          const isWrong = result && i === selected && !result.isCorrect;
          const cls = isCorrect ? 'border-success/50 bg-success/20 text-success' : isWrong ? 'border-error/50 bg-error/20 text-error' : result ? 'border-border dark:border-white/5 text-text-muted opacity-60' : 'border-border dark:border-white/10 hover:bg-brand-500/15 hover:border-brand-500/40';
          return (
            <button
              key={o.id}
              disabled={!!result || check.isPending}
              onClick={() => {
                setSelected(i);
                check.mutate({ questionId: q.questionId, option: i });
              }}
              aria-label={isCorrect ? `${o.text} — ${t('correctA11y')}` : isWrong ? `${o.text} — ${t('wrongA11y')}` : undefined}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${cls}`}
            >
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
              <MarkdownContent inline>{o.text}</MarkdownContent>
            </button>
          );
        })}
      </div>
      {result && (
        <div aria-live="polite" className="rounded-xl border border-border dark:border-white/10 p-4 space-y-2">
          <p className={`font-bold ${result.isCorrect ? 'text-success' : 'text-error'}`}>{result.isCorrect ? t('correct') : t('incorrect')}</p>
          {result.explanation && (
            <div className="text-sm text-text-muted">
              <MarkdownContent>{result.explanation}</MarkdownContent>
            </div>
          )}
          <button
            onClick={() => {
              setIndex((n) => n + 1);
              setSelected(null);
              setResult(null);
            }}
            className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2 text-sm font-bold text-white"
          >
            {index + 1 < questions.length ? t('next') : t('finish')}
          </button>
        </div>
      )}
    </div>,
  );
}
