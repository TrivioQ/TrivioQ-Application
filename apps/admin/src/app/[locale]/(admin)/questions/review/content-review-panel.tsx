'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DifficultyLevel, AgeRating } from '@trivioq/database';
import { ReviewEditor } from './review-editor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/use-table-params';
import { buttonVariants } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, CheckSquare } from 'lucide-react';
import { bulkApprovePendingQuestions, bulkRejectPendingQuestions, bulkRequeuePendingQuestions } from '@/app/actions/pending-questions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { AppSelect } from '@/components/ui/app-select';
import { toast } from 'sonner';


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
  ageRating: AgeRating;
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
  const confirm = useConfirm();
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.slug, c.name])), [categories]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState(questions);
  const [prevQuestionsProp, setPrevQuestionsProp] = useState(questions);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, startBulkTransition] = useTransition();
  const { pushParams, isPending, searchParams } = useTableParams();

  const createTabHref = (filterVal?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1'); // reset to page 1 on tab switch
    if (filterVal) {
      params.set('filter', filterVal);
    } else {
      params.delete('filter');
    }
    return `?${params.toString()}`;
  };

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
        toast.success(t('approveSuccess'));
        setPendingQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedQuestionIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleBulkReject = async () => {
    const ok = await confirm({
      title: t('bulkRejectConfirmTitle', { defaultMessage: 'Reject Questions' }),
      message: t('bulkRejectConfirmMsg', { defaultMessage: 'Are you sure you want to reject the selected questions?' }),
      confirmLabel: t('bulkRejectConfirmBtn', { defaultMessage: 'Reject' }),
      cancelLabel: t('cancel', { defaultMessage: 'Cancel' }),
      isDestructive: true,
    });
    if (!ok) return;

    startBulkTransition(async () => {
      const ids = Array.from(selectedQuestionIds);
      const res = await bulkRejectPendingQuestions(ids);
      if (res.success) {
        toast.success(t('rejectSuccess'));
        setPendingQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedQuestionIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleBulkRequeue = () => {
    startBulkTransition(async () => {
      const ids = Array.from(selectedQuestionIds);
      const res = await bulkRequeuePendingQuestions(ids);
      if (res.success) {
        toast.success(t('requeueSuccess'));
        setPendingQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedQuestionIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  function scoreBadge(score: number | null) {
    if (score == null) return null;
    if (score > 80) return { className: 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300', label: t('scoreBadge.high', { score }) };
    if (score >= 50) return { className: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300', label: t('scoreBadge.medium', { score }) };
    return { className: 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300', label: t('scoreBadge.low', { score }) };
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
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        <Link href={createTabHref()} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${!filter ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {t('filters.pending')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${!filter ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{displayCount('unvalidated', counts.unvalidated)}</span>
        </Link>
        <Link href={createTabHref('ai-validated')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-validated' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {t('filters.aiValidated')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'ai-validated' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{displayCount('aiValidated', counts.aiValidated)}</span>
        </Link>
        <Link href={createTabHref('ai-rejected')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-rejected' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {t('filters.aiRejected')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'ai-rejected' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{displayCount('aiRejected', counts.aiRejected)}</span>
        </Link>
        <Link href={createTabHref('pending-duplicate')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'pending-duplicate' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {t('filters.pendingDuplicates')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'pending-duplicate' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{displayCount('pendingDuplicate', counts.pendingDuplicate)}</span>
        </Link>
        <Link href={createTabHref('rejected')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'rejected' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {t('filters.rejected')}
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${filter === 'rejected' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{displayCount('rejected', counts.rejected)}</span>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 border border-border rounded-xl bg-card shadow-sm overflow-hidden h-auto lg:h-[calc(100vh-220px)] min-h-[400px] lg:min-h-[600px]">
        {/* ── Left: Question List ── */}
        <aside className="w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/20 flex flex-col h-64 lg:h-auto">
          <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedQuestionIds.size === pendingQuestions.length && pendingQuestions.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label={t('selectAll')}
              />
              <p className="text-sm font-semibold text-foreground">
                {t('selectAll')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedQuestionIds.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 text-xs px-2 gap-1' }), isBulkUpdating && 'opacity-50 pointer-events-none')}>
                    {isBulkUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckSquare className="h-3 w-3" />}
                    {t('bulkActions')}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(filter === 'ai-validated' || filter === 'pending-duplicate') && (
                      <DropdownMenuItem onClick={handleBulkApprove} className="text-green-600 focus:text-green-700">
                        {t('approveSelected')}
                      </DropdownMenuItem>
                    )}
                    {(filter === 'ai-rejected' || filter === 'rejected') && (
                      <DropdownMenuItem onClick={handleBulkRequeue} className="text-orange-600 focus:text-orange-700">
                        {t('requeueSelected')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleBulkReject} className="text-red-600 focus:text-red-700">
                      {t('rejectSelected')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {pendingQuestions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">{t('noPending')}</div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-border">
              {pendingQuestions.map((q) => (
                <li key={q.id} className="relative group">
                  <div className="absolute left-3 top-3.5 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedQuestionIds.has(q.id)}
                      onCheckedChange={(checked) => toggleSelect(q.id, checked === true)}
                    />
                  </div>
                  <button onClick={() => setSelectedId(q.id)} className={cn('w-full text-left pl-10 pr-4 py-3 transition-colors hover:bg-accent', selectedId === q.id && 'bg-accent/50 border-l-2 border-l-brand-500 hover:bg-accent/50', q.isDuplicate && q.status !== 'PENDING-DUPLICATE' && 'opacity-50 grayscale')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{q.topic}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{q.suggestedText}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {q.status === 'PENDING-DUPLICATE' && (
                        <Badge className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/30">
                          {t('pendingDuplicateBadge')}
                        </Badge>
                      )}
                      {q.status === 'REJECTED' && (
                        <Badge className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/30">
                          {t('rejectedBadge')}
                        </Badge>
                      )}
                      {q.status === 'AI-REJECTED' && (
                        <Badge className="text-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/30">
                          {t('aiRejectedBadge')}
                        </Badge>
                      )}
                      {q.isDuplicate && q.status !== 'PENDING-DUPLICATE' && (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('duplicateBadge')}
                        </Badge>
                      )}
                      {q.aiQualityScore != null && scoreBadge(q.aiQualityScore) != null && <span className={cn('inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-[10px] font-medium', scoreBadge(q.aiQualityScore)!.className)}>{scoreBadge(q.aiQualityScore)!.label}</span>}
                      {q.categorySlugs.map(slug => {
                        const catName = categoryMap.get(slug);
                        return (
                          <Badge key={slug} variant="secondary" className="text-[10px] shrink-0">
                            {catName || slug}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
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
        <main className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">{selected ? <ReviewEditor key={selected.id} pendingQuestion={selected} categories={categories} onComplete={handleComplete} /> : <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">{t('selectPrompt')}</div>}</main>
      </div>

      {/* Pagination */}
      <div className={`flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
        <span>{total === 0 ? t('noResults') : t('showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, total), total })}</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('rowsPerPage')}</span>
            <AppSelect
              value={String(pageSize)}
              onValueChange={(v) => pushParams({ pageSize: v as string, page: '1' })}
              className="w-16"
              options={[
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pushParams({ page: '1' })}
              disabled={page <= 1 || isPending}
              className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
              aria-label={t('firstPage')}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => pushParams({ page: String(page - 1) })}
              disabled={page <= 1 || isPending}
              className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
              aria-label={t('previousPage')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium px-2">{t('pageOf', { page, totalPages })}</span>
            <button
              onClick={() => pushParams({ page: String(page + 1) })}
              disabled={page >= totalPages || isPending}
              className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
              aria-label={t('nextPage')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => pushParams({ page: String(totalPages) })}
              disabled={page >= totalPages || isPending}
              className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
              aria-label={t('lastPage')}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
