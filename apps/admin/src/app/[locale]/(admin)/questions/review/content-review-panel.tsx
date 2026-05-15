'use client';

import { useState } from 'react';
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
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function ContentReviewPanel({
  questions,
  categories,
}: {
  questions: PendingQuestion[];
  categories: Category[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState(questions);

  const selected = pendingQuestions.find((q) => q.id === selectedId) ?? null;

  const handleComplete = (id: string) => {
    setPendingQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedId(null);
  };

  return (
    <div className="flex gap-0 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden min-h-[600px]">
      {/* ── Left: Question List ── */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <p className="text-sm font-semibold text-gray-700">
            Pending Questions
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {pendingQuestions.length}
            </span>
          </p>
        </div>

        {pendingQuestions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-400">
            No pending questions to review.
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {pendingQuestions.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() => setSelectedId(q.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors hover:bg-gray-100',
                    selectedId === q.id && 'bg-blue-50 border-l-2 border-l-blue-500 hover:bg-blue-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {q.topic}
                    </p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {q.categorySlug}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {q.suggestedText}
                  </p>
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
      <main className="flex-1 flex flex-col">
        {selected ? (
          <ReviewEditor
            key={selected.id}
            pendingQuestion={selected}
            categories={categories}
            onComplete={handleComplete}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a question from the list to review.
          </div>
        )}
      </main>
    </div>
  );
}
