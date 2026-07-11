'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DifficultyLevel } from '@trivioq/database';
import { ReviewEditor } from './review-editor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/use-table-params';
import { buttonVariants } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PendingQuestion {
  id: string;
  topic: string;
  categorySlugs: string[];
  difficultyLevel: DifficultyLevel;
  suggestedText: string;
  suggestedChoices: any;
  hint: string | null;
  explanation: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  aiQualityScore: number | null;
  aiFeedback: string | null;
  isDuplicate: boolean;
  replacesQuestionId: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface PaginatedResult {
  data: PendingQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ContentReviewPanelProps {
  questions: PendingQuestion[];
  categories: Category[];
  result: PaginatedResult;
  filter?: string;
}

export function ContentReviewPanel({ questions, categories, result, filter }: ContentReviewPanelProps) {
  const t = useTranslations('review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState(questions);
  const [prevQuestionsProp, setPrevQuestionsProp] = useState(questions);
  const { pushParams, isPending } = useTableParams();

  const { page, totalPages, total, pageSize } = result;

  // Update internal state when the questions prop changes (React recommended pattern)
  if (questions !== prevQuestionsProp) {
    setPrevQuestionsProp(questions);
    setPendingQuestions(questions);
    setSelectedId(null);
  }

  const selected = pendingQuestions.find((q) => q.id === selectedId) ?? null;

  const handleComplete = (id: string) => {
    setPendingQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedId(null);
  };

  function scoreBadge(score: number | null) {
    if (score == null) return null;
    if (score > 80) return { className: 'bg-green-100 text-green-800', label: t('scoreBadge.high', { score }) };
    if (score >= 50) return { className: 'bg-yellow-100 text-yellow-800', label: t('scoreBadge.medium', { score }) };
    return { className: 'bg-red-100 text-red-800', label: t('scoreBadge.low', { score }) };
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden h-[calc(100vh-220px)] min-h-[600px]">
        {/* ── Left: Question List ── */}
        <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <p className="text-sm font-semibold text-gray-700">
              {t('pendingQuestions')}
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{pendingQuestions.length}</span>
            </p>
          </div>

          {pendingQuestions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-400">{t('noPending')}</div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {pendingQuestions.map((q) => (
                <li key={q.id}>
                  <button onClick={() => setSelectedId(q.id)} className={cn('w-full text-left px-4 py-3 transition-colors hover:bg-gray-100', selectedId === q.id && 'bg-blue-50 border-l-2 border-l-blue-500 hover:bg-blue-50', q.isDuplicate && q.status !== 'PENDING-DUPLICATE' && 'opacity-50 grayscale')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{q.topic}</p>
                      <div className="flex gap-1 flex-wrap">
                        {q.categorySlugs.map(slug => (
                          <Badge key={slug} variant="secondary" className="text-[10px] shrink-0">
                            {slug}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{q.suggestedText}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {q.status === 'PENDING-DUPLICATE' && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                          {t('pendingDuplicateBadge')}
                        </Badge>
                      )}
                      {q.status === 'REJECTED' && (
                        <Badge className="text-[10px] bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                          {t('rejectedBadge')}
                        </Badge>
                      )}
                      {q.status === 'AI-REJECTED' && (
                        <Badge className="text-[10px] bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
                          AI Rejected
                        </Badge>
                      )}
                      {q.isDuplicate && q.status !== 'PENDING-DUPLICATE' && (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('duplicateBadge')}
                        </Badge>
                      )}
                      {q.aiQualityScore != null && scoreBadge(q.aiQualityScore) != null && <span className={cn('inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-[10px] font-medium', scoreBadge(q.aiQualityScore)!.className)}>{scoreBadge(q.aiQualityScore)!.label}</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {new Date(q.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Right: Editor ── */}
        <main className="flex-1 flex flex-col">{selected ? <ReviewEditor key={selected.id} pendingQuestion={selected} categories={categories} onComplete={handleComplete} /> : <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{t('selectPrompt')}</div>}</main>
      </div>

      {/* Pagination */}
      <div className={`flex items-center justify-between text-sm text-gray-600 transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
        <span>{total === 0 ? t('noResults') : t('showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, total), total })}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pushParams({ page: String(page - 1) })}
            disabled={page <= 1 || isPending}
            className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium">{t('pageOf', { page, totalPages })}</span>
          <button
            onClick={() => pushParams({ page: String(page + 1) })}
            disabled={page >= totalPages || isPending}
            className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
            aria-label={t('nextPage')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
