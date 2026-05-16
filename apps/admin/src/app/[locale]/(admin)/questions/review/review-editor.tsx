'use client';

import { useState, useTransition } from 'react';
import {
  approvePendingQuestion,
  rejectPendingQuestion,
  type EditQuestionPayload,
} from '@/app/actions/pending-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DifficultyLevel } from '@trivioq/database';
import type { SuggestedChoice } from '@trivioq/shared-types';
import { formatDistanceToNow } from 'date-fns';

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
  aiFeedback: string | null;
  aiQualityScore: number | null;
  isDuplicate: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

function parseChoices(raw: unknown): SuggestedChoice[] {
  if (Array.isArray(raw)) {
    return raw.map((c: Record<string, unknown>, idx: number) => ({
      text: String(c.text ?? ''),
      order: typeof c.order === 'number' ? c.order : idx,
      isCorrect: Boolean(c.isCorrect),
    }));
  }
  return [
    { text: '', order: 0, isCorrect: true },
    { text: '', order: 1, isCorrect: false },
    { text: '', order: 2, isCorrect: false },
    { text: '', order: 3, isCorrect: false },
  ];
}

export function ReviewEditor({
  pendingQuestion,
  categories,
  onComplete,
}: {
  pendingQuestion: PendingQuestion;
  categories: Category[];
  onComplete: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [questionText, setQuestionText] = useState(pendingQuestion.suggestedText);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('EASY');
  const [choices, setChoices] = useState(() => parseChoices(pendingQuestion.suggestedChoices));
  const [hintText, setHintText] = useState(pendingQuestion.hint ?? '');
  const [explanationText, setExplanationText] = useState(pendingQuestion.explanation ?? '');
  const [categorySlug, setCategorySlug] = useState(pendingQuestion.categorySlug);

  const markCorrect = (idx: number) => {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === idx })));
  };

  const updateChoiceText = (idx: number, text: string) => {
    setChoices((prev) => prev.map((c, i) => (i === idx ? { ...c, text } : c)));
  };

  const handleApprove = () => {
    const payload: EditQuestionPayload = {
      questionText,
      difficultyLevel,
      categorySlug,
      choices: choices.map((c, idx) => ({ ...c, order: c.order ?? idx })),
      hintText: hintText || undefined,
      explanationText: explanationText || undefined,
    };

    startTransition(async () => {
      const res = await approvePendingQuestion(pendingQuestion.id, payload);
      if (res.success) {
        onComplete(pendingQuestion.id);
      } else {
        alert(res.error);
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectPendingQuestion(
        pendingQuestion.id,
        rejectionReason || undefined,
      );
      if (res.success) {
        setRejectDialogOpen(false);
        setRejectionReason('');
        onComplete(pendingQuestion.id);
      } else {
        alert(res.error);
      }
    });
  };

  const selectedCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {pendingQuestion.topic}
          </p>
          <p className="text-xs text-gray-400">
            Submitted{' '}
            {formatDistanceToNow(new Date(pendingQuestion.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRejectDialogOpen(true)}
          >
            Reject
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={isPending}>
            {isPending ? 'Publishing...' : 'Approve & Publish'}
          </Button>
        </div>
      </div>

      {/* AI Feedback & Warnings */}
      {(pendingQuestion.isDuplicate || pendingQuestion.aiFeedback) && (
        <div className="px-6 py-3 space-y-3 border-b border-gray-200 bg-gray-50/50">
          {pendingQuestion.isDuplicate && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <span className="text-base shrink-0">&#9888;</span>
              <span>
                <strong>DUPLICATE DETECTED</strong> — This question appears to be a
                duplicate of an existing question. Review carefully before approving.
              </span>
            </div>
          )}
          {pendingQuestion.aiFeedback && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                AI Feedback
              </p>
              <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                {pendingQuestion.aiFeedback}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Question Text */}
        <div className="space-y-1.5">
          <Label htmlFor="questionText">Question Text</Label>
          <Textarea
            id="questionText"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="resize-none"
            rows={3}
          />
        </div>

        {/* Difficulty */}
        <div className="space-y-1.5">
          <Label>Difficulty Level</Label>
          <Select
            value={difficultyLevel}
            onValueChange={(val) => setDifficultyLevel(val as DifficultyLevel)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={categorySlug}
            onValueChange={(val) => setCategorySlug(val ?? '')}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCategory ? (
            <p className="text-xs text-gray-400">Slug: {selectedCategory.slug}</p>
          ) : (
            <p className="text-xs text-amber-500">
              No existing category matches &quot;{categorySlug}&quot; — the
              category slug must match an existing category.
            </p>
          )}
        </div>

        {/* Choices */}
        <div className="space-y-2">
          <Label>
            Choices — select the radio button to mark the correct answer
          </Label>
          {choices.map((choice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctAnswer"
                title="Mark as correct answer"
                checked={choice.isCorrect}
                onChange={() => markCorrect(idx)}
                className="h-4 w-4 shrink-0"
              />
              <Input
                required
                placeholder={`Choice ${idx + 1}`}
                value={choice.text}
                onChange={(e) => updateChoiceText(idx, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="space-y-1.5">
          <Label htmlFor="hintText">Hint (Optional)</Label>
          <Textarea
            id="hintText"
            value={hintText}
            onChange={(e) => setHintText(e.target.value)}
            className="resize-none"
            rows={2}
            placeholder="A clue to help users narrow down the answer..."
          />
        </div>

        {/* Explanation */}
        <div className="space-y-1.5">
          <Label htmlFor="explanationText">Explanation (Optional)</Label>
          <Textarea
            id="explanationText"
            value={explanationText}
            onChange={(e) => setExplanationText(e.target.value)}
            className="resize-none"
            rows={3}
            placeholder="Explain why the answer is correct..."
          />
        </div>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting this question. This will
              be saved and can help the content team improve future submissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="rejectionReason">Rejection Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., inaccurate content, poorly worded, duplicate question..."
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason('');
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
