'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DifficultyLevel } from '@trivioq/database';
import { ReviewEditor } from './review-editor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/use-table-params';
import { buttonVariants } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, CheckSquare } from 'lucide-react';
import { bulkApprovePendingQuestions, bulkRejectPendingQuestions } from '@/app/actions/pending-questions';
import { useTransition } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
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
  counts?: {
    unvalidated: number;
    aiValidated: number;
    aiRejected: number;
    pendingDuplicate: number;
    rejected: number;
  };
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, startBulkTransition] = useTransition();
  const { pushParams, isPending } = useTableParams();

  const { page, totalPages, total, pageSize } = result;

  // Update internal state when the questions prop changes (React recommended pattern)
  if (questions !== prevQuestionsProp) {
    setPrevQuestionsProp(questions);
    setPendingQuestions(questions);
    setSelectedId(null);
    setSelectedQuestionIds(new Set());
  }

  const selected = pendingQuestions.find((q) => q.id === selectedId) ?? null;

  const handleComplete = (id: string) => {
    setPendingQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedId(null);
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.size === pendingQuestions.length && pendingQuestions.length > 0) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(pendingQuestions.map((q) => q.id)));
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkApprove = () => {
    startBulkTransition(async () => {
      const ids = Array.from(selectedQuestionIds);
      const res = await bulkApprovePendingQuestions(ids);
      if (res.success) {
        setPendingQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedQuestionIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      }
    });
  };

  const handleBulkReject = () => {
    startBulkTransition(async () => {
      const ids = Array.from(selectedQuestionIds);
      const res = await bulkRejectPendingQuestions(ids);
      if (res.success) {
        setPendingQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedQuestionIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      }
    });
  };

  function scoreBadge(score: number | null) {
    if (score == null) return null;
    if (score > 80) return { className: 'bg-green-100 text-green-800', label: t('scoreBadge.high', { score }) };
    if (score >= 50) return { className: 'bg-yellow-100 text-yellow-800', label: t('scoreBadge.medium', { score }) };
    return { className: 'bg-red-100 text-red-800', label: t('scoreBadge.low', { score }) };
  }

  const activeTabDiff = questions.length - pendingQuestions.length;
  const counts = result.counts || {
    unvalidated: !filter ? total : 0,
    aiValidated: filter === 'ai-validated' ? total : 0,
    aiRejected: filter === 'ai-rejected' ? total : 0,
    pendingDuplicate: filter === 'pending-duplicate' ? total : 0,
    rejected: filter === 'rejected' ? total : 0,
  };

  const displayCount = (tab: string, baseCount: number) => {
    if (
      (tab === 'unvalidated' && !filter) ||
      (tab === 'aiValidated' && filter === 'ai-validated') ||
      (tab === 'aiRejected' && filter === 'ai-rejected') ||
      (tab === 'pendingDuplicate' && filter === 'pending-duplicate') ||
      (tab === 'rejected' && filter === 'rejected')
    ) {
      return Math.max(0, baseCount - activeTabDiff);
    }
    return baseCount;
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        <Link href="?" className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${!filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.unvalidated')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${!filter ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{displayCount('unvalidated', counts.unvalidated)}</span>
        </Link>
        <Link href="?filter=ai-validated" className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-validated' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.aiValidated')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'ai-validated' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{displayCount('aiValidated', counts.aiValidated)}</span>
        </Link>
        <Link href="?filter=ai-rejected" className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.aiRejected')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'ai-rejected' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{displayCount('aiRejected', counts.aiRejected)}</span>
        </Link>
        <Link href="?filter=pending-duplicate" className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'pending-duplicate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.pendingDuplicates')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'pending-duplicate' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{displayCount('pendingDuplicate', counts.pendingDuplicate)}</span>
        </Link>
        <Link href="?filter=rejected" className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.rejected')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'rejected' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{displayCount('rejected', counts.rejected)}</span>
        </Link>
      </div>

      <div className="flex gap-0 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden h-[calc(100vh-220px)] min-h-[600px]">
        {/* ── Left: Question List ── */}
        <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={selectedQuestionIds.size === pendingQuestions.length && pendingQuestions.length > 0} 
                onCheckedChange={toggleSelectAll} 
                aria-label={t('selectAll')}
              />
              <p className="text-sm font-semibold text-gray-700">
                {t('pendingQuestions')}
              </p>
            </div>
            
            {selectedQuestionIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 text-xs px-2 gap-1' })} disabled={isBulkUpdating}>
                  {isBulkUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckSquare className="h-3 w-3" />}
                  {t('bulkActions')}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleBulkApprove} className="text-green-600 focus:text-green-700">
                    {t('approveSelected')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkReject} className="text-red-600 focus:text-red-700">
                    {t('rejectSelected')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {pendingQuestions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-400">{t('noPending')}</div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {pendingQuestions.map((q) => (
                <li key={q.id} className="relative group">
                  <div className="absolute left-3 top-3.5 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedQuestionIds.has(q.id)}
                      onCheckedChange={(checked) => toggleSelect(q.id, checked === true)}
                    />
                  </div>
                  <button onClick={() => setSelectedId(q.id)} className={cn('w-full text-left pl-10 pr-4 py-3 transition-colors hover:bg-gray-100', selectedId === q.id && 'bg-blue-50 border-l-2 border-l-blue-500 hover:bg-blue-50', q.isDuplicate && q.status !== 'PENDING-DUPLICATE' && 'opacity-50 grayscale')}>
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
