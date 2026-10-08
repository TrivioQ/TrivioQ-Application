'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import type { DropHistoryFilter, DropHistoryItem } from '@trivioq/shared-types';
import { api } from '@/lib/queries';
import { MarkdownContent } from '@/components/markdown-content';

const FILTERS: DropHistoryFilter[] = ['all', 'correct', 'incorrect', 'revealed'];

const DIFF_COLOR: Record<string, string> = {
  EASY: 'text-success bg-success/10',
  MEDIUM: 'text-brand-400 bg-brand-400/10',
  HARD: 'text-error bg-error/10',
};

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={selected} onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${selected ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'border-border dark:border-white/10 text-text-muted hover:text-text'}`}>
      {label}
    </button>
  );
}

function DropCard({ drop, locale }: { drop: DropHistoryItem; locale: string }) {
  const t = useTranslations('history');
  const [open, setOpen] = useState(false);
  const selected = drop.question.choices.find((c) => c.id === drop.selectedChoiceId);
  const correct = drop.question.choices.find((c) => c.isCorrect);
  const status = drop.revealedAnswer ? 'revealed' : drop.wasCorrect ? 'correct' : 'incorrect';

  return (
    <li className="rounded-2xl bg-bg/70 dark:bg-white/5 border border-brand-100 dark:border-white/10 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ${DIFF_COLOR[drop.question.difficultyLevel]}`}>{drop.question.difficultyLevel}</span>
        {drop.question.categories[0] && <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-text-muted">{drop.question.categories[0].name}</span>}
        <span className="ml-auto text-text-muted">{drop.answeredAt ? new Date(drop.answeredAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
      </div>

      <div className="text-sm font-semibold text-text">
        <MarkdownContent>{drop.question.questionText}</MarkdownContent>
      </div>

      <div className="rounded-xl bg-bg-secondary/60 dark:bg-white/5 p-3 text-xs space-y-1">
        {selected && (
          <p>
            <span className="text-text-muted">{t('yourAnswer')} </span>
            <span className={drop.wasCorrect ? 'text-success font-semibold' : 'text-error font-semibold'}>
              {drop.wasCorrect ? '✓ ' : '✗ '}
              {selected.text}
            </span>
          </p>
        )}
        {!drop.wasCorrect && correct && (
          <p>
            <span className="text-text-muted">{t('correctAnswer')} </span>
            <span className="text-success font-semibold">{correct.text}</span>
          </p>
        )}
      </div>

      {drop.question.explanationText && (
        <div>
          <button aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-brand-500 hover:text-brand-400">
            {open ? `▾ ${t('hideExplanation')}` : `▸ ${t('whyAnswer')}`}
          </button>
          {open && (
            <div className="mt-2 rounded-xl bg-brand-500/10 p-3 text-xs text-text-muted">
              <MarkdownContent>{drop.question.explanationText}</MarkdownContent>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border dark:border-white/10 pt-3 text-xs">
        <span className={`flex items-center gap-1.5 font-semibold ${status === 'correct' ? 'text-success' : status === 'revealed' ? 'text-warning' : 'text-error'}`}>
          {status === 'correct' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : status === 'revealed' ? <Eye className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
          {t(`filter.${status}`)}
        </span>
        {drop.pointsAwarded > 0 && <span className="font-bold text-brand-500">{t('pointsAwarded', { count: drop.pointsAwarded })}</span>}
      </div>
    </li>
  );
}

export function HistoryView() {
  const t = useTranslations('history');
  const locale = useLocale();
  const [filter, setFilter] = useState<DropHistoryFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['dropHistory', filter, category],
    queryFn: async ({ pageParam }) => {
      const page = await api.dropHistory({ filter, category, cursor: pageParam });
      setKnownCategories((prev) => {
        const next = new Set(prev);
        page.drops.forEach((d) => d.question.categories.forEach((c) => next.add(c.name)));
        return next.size === prev.length ? prev : Array.from(next).sort();
      });
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const drops = useMemo(() => data?.pages.flatMap((p) => p.drops) ?? [], [data]);

  return (
    <div className="min-h-screen text-text">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('title')}</h1>
            <p className="text-text-muted mt-2">{t('subtitle')}</p>
          </div>
          <Link href="/review" className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-sm font-semibold text-brand-600 dark:text-brand-300 hover:bg-brand-500/20 transition-colors">
            🧠 {t('reviewMistakes')}
          </Link>
        </div>

        <div className="space-y-3">
          <div role="group" aria-label={t('filterLabel')} className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <Chip key={f} label={t(`filter.${f}`)} selected={filter === f} onClick={() => setFilter(f)} />
            ))}
          </div>
          {knownCategories.length > 1 && (
            <div role="group" aria-label={t('categoryLabel')} className="flex gap-2 overflow-x-auto pb-1">
              <Chip label={t('allCategories')} selected={category === null} onClick={() => setCategory(null)} />
              {knownCategories.map((c) => (
                <Chip key={c} label={c} selected={category === c} onClick={() => setCategory(category === c ? null : c)} />
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-bg/70 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-16 text-center text-error">{t('error')}</p>
        ) : drops.length === 0 ? (
          <p className="py-16 text-center text-text-muted">{filter === 'all' && !category ? t('empty') : t('emptyFiltered')}</p>
        ) : (
          <ul className="space-y-3">
            {drops.map((d) => (
              <DropCard key={d.id} drop={d} locale={locale} />
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-colors">
              {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
