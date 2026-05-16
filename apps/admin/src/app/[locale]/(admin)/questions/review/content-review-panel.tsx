'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReviewEditor } from './review-editor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PendingQuestion {
  id: string;
  topic: string;
  categorySlug: string;
  suggestedText: string;
  suggestedChoices: unknown;
  hint: string | null;
  explanation: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  aiQualityScore: number | null;
  aiFeedback: string | null;
  isDuplicate: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function ContentReviewPanel({ questions, categories }: { questions: PendingQuestion[]; categories: Category[] }) {
  const t = useTranslations('review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState(questions);

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
    <div className="flex gap-0 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden min-h-[600px]">
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
                <button onClick={() => setSelectedId(q.id)} className={cn('w-full text-left px-4 py-3 transition-colors hover:bg-gray-100', selectedId === q.id && 'bg-blue-50 border-l-2 border-l-blue-500 hover:bg-blue-50', q.isDuplicate && 'opacity-50 grayscale')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{q.topic}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {q.categorySlug}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{q.suggestedText}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {q.isDuplicate && (
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
  );
}
