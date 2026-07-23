'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { approvePendingQuestion, rejectPendingQuestion, requeuePendingQuestion, updatePendingQuestion, type EditQuestionPayload } from '@/app/actions/pending-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DifficultyLevel, AgeRating } from '@trivioq/database';
import type { SuggestedChoice } from '@trivioq/shared-types';
import { formatDistanceToNow } from 'date-fns';
import { Check } from 'lucide-react';

interface PendingQuestion {
  id: string;
  topic: string;
  categorySlugs: string[];
  difficultyLevel: DifficultyLevel;
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
  replacesQuestionId: string | null;
  ageRating: AgeRating;
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

export function ReviewEditor({ pendingQuestion, categories, onComplete }: { pendingQuestion: PendingQuestion; categories: Category[]; onComplete: (id: string) => void }) {
  const t = useTranslations('review.editor');
  const [isPending, startTransition] = useTransition();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [questionText, setQuestionText] = useState(pendingQuestion.suggestedText);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(pendingQuestion.difficultyLevel ?? 'EASY');
  const [ageRating, setAgeRating] = useState<AgeRating>(pendingQuestion.ageRating ?? 'ALL');
  const [choices, setChoices] = useState(() => parseChoices(pendingQuestion.suggestedChoices));
  const [hintText, setHintText] = useState(pendingQuestion.hint ?? '');
  const [explanationText, setExplanationText] = useState(pendingQuestion.explanation ?? '');
  const [categorySlugs, setCategorySlugs] = useState<string[]>(pendingQuestion.categorySlugs || []);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const addCategory = (slug: string | null) => {
    if (!slug) return;
    if (categorySlugs.length < 2 && !categorySlugs.includes(slug)) {
      setCategorySlugs([...categorySlugs, slug]);
    }
  };

  const removeCategory = (slug: string) => {
    setCategorySlugs(categorySlugs.filter((s) => s !== slug));
  };

  const markCorrect = (idx: number) => {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === idx })));
  };

  const updateChoiceText = (idx: number, text: string) => {
    setChoices((prev) => prev.map((c, i) => (i === idx ? { ...c, text } : c)));
  };

  const buildPayload = (): EditQuestionPayload => ({
    questionText,
    difficultyLevel,
    categorySlugs,
    choices: choices.map((c, idx) => ({ ...c, order: c.order ?? idx })),
    hintText: hintText || undefined,
    explanationText: explanationText || undefined,
    ageRating,
  });

  const handleSave = () => {
    startTransition(async () => {
      const res = await updatePendingQuestion(pendingQuestion.id, buildPayload());
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert(res.error);
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      const saveRes = await updatePendingQuestion(pendingQuestion.id, buildPayload());
      if (!saveRes.success) {
        alert(saveRes.error);
        return;
      }
      const res = await approvePendingQuestion(pendingQuestion.id, buildPayload());
      if (res.success) {
        onComplete(pendingQuestion.id);
      } else {
        alert(res.error);
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const saveRes = await updatePendingQuestion(pendingQuestion.id, buildPayload());
      if (!saveRes.success) {
        alert(saveRes.error);
        return;
      }
      const res = await rejectPendingQuestion(pendingQuestion.id, rejectionReason || undefined);
      if (res.success) {
        setRejectDialogOpen(false);
        setRejectionReason('');
        onComplete(pendingQuestion.id);
      } else {
        alert(res.error);
      }
    });
  };

  const handleRequeue = () => {
    startTransition(async () => {
      const saveRes = await updatePendingQuestion(pendingQuestion.id, buildPayload());
      if (!saveRes.success) {
        alert(saveRes.error);
        return;
      }
      const res = await requeuePendingQuestion(pendingQuestion.id);
      if (res.success) {
        onComplete(pendingQuestion.id);
      } else {
        alert(res.error);
      }
    });
  };



  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{pendingQuestion.topic}</p>
          <p className="text-xs text-gray-400">
            {t('submitted')}{' '}
            {formatDistanceToNow(new Date(pendingQuestion.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingQuestion.status !== 'REJECTED' && pendingQuestion.status !== 'AI-REJECTED' && (
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(true)} disabled={isPending}>
              {t('reject')}
            </Button>
          )}
          {pendingQuestion.status === 'AI-REJECTED' && (
            <Button variant="outline" size="sm" onClick={handleRequeue} disabled={isPending}
              className="border-orange-300 text-orange-700 hover:bg-orange-50">
              {isPending ? t('requeueing') : t('requeue')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? t('saving') : saveSuccess ? <><Check className="mr-1 h-3.5 w-3.5" />{t('saved')}</> : t('saveChanges')}
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={isPending}>
            {isPending
              ? pendingQuestion.status === 'PENDING-DUPLICATE' ? t('replacing') : t('publishing')
              : pendingQuestion.status === 'PENDING-DUPLICATE' ? t('approveAndReplace') : t('approve')}
          </Button>
        </div>
      </div>

      {/* AI Feedback & Warnings */}
      {(pendingQuestion.status === 'PENDING-DUPLICATE' || pendingQuestion.status === 'REJECTED' || pendingQuestion.status === 'AI-REJECTED' || pendingQuestion.isDuplicate || pendingQuestion.aiFeedback || pendingQuestion.rejectionReason) && (
        <div className="px-6 py-3 space-y-3 border-b border-gray-200 bg-gray-50/50">
          {pendingQuestion.status === 'PENDING-DUPLICATE' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
              <span className="text-base shrink-0">⚡</span>
              <span>{t('pendingDuplicateWarning')}</span>
            </div>
          )}
          {pendingQuestion.status === 'REJECTED' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <span className="text-base shrink-0">❌</span>
              <span>{t('rejectedWarning')}</span>
            </div>
          )}
          {pendingQuestion.status === 'AI-REJECTED' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-300 rounded-lg text-sm text-orange-900">
              <span className="text-base shrink-0">🤖</span>
              <span>{t('aiValidationFailedWarning')}</span>
            </div>
          )}
          {pendingQuestion.isDuplicate && pendingQuestion.status !== 'PENDING-DUPLICATE' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <span className="text-base shrink-0">&#9888;</span>
              <span>{t('duplicateWarning')}</span>
            </div>
          )}
          {pendingQuestion.rejectionReason && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('rejectionReasonLabel')}</p>
              <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{pendingQuestion.rejectionReason}</div>
            </div>
          )}
          {pendingQuestion.aiFeedback && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('aiFeedback')}</p>
              <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{pendingQuestion.aiFeedback}</div>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Question Text */}
        <div className="space-y-1.5">
          <Label htmlFor="questionText">{t('questionText')}</Label>
          <Textarea id="questionText" value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="resize-none" rows={3} />
        </div>

        {/* Difficulty & Age Rating */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('difficultyLevel')}</Label>
            <Select value={difficultyLevel} onValueChange={(val) => setDifficultyLevel(val as DifficultyLevel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">{t('easy')}</SelectItem>
                <SelectItem value="MEDIUM">{t('medium')}</SelectItem>
                <SelectItem value="HARD">{t('hard')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('ageRating')}</Label>
            <Select value={ageRating} onValueChange={(val) => setAgeRating(val as AgeRating)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('ratingAll')}</SelectItem>
                <SelectItem value="TEEN">{t('ratingTeen')}</SelectItem>
                <SelectItem value="MATURE">{t('ratingMature')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>{t('category')}</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {categorySlugs.map((slug) => {
              const cat = categories.find(c => c.slug === slug);
              return (
                <div key={slug} className="flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {cat?.name || slug}
                  <button type="button" onClick={() => removeCategory(slug)} className="text-gray-500 hover:text-red-500 font-bold ml-1">
                     &times;
                  </button>
                </div>
              );
            })}
          </div>
          {categorySlugs.length < 2 && (
            <Select onValueChange={addCategory} value="">
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('addCategoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => !categorySlugs.includes(c.slug)).map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Choices */}
        <div className="space-y-2">
          <Label>{t('choicesLabel')}</Label>
          {choices.map((choice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="radio" name="correctAnswer" title={t('markCorrect')} checked={choice.isCorrect} onChange={() => markCorrect(idx)} className="h-4 w-4 shrink-0" />
              <Input required placeholder={t('choicePlaceholder', { number: idx + 1 })} value={choice.text} onChange={(e) => updateChoiceText(idx, e.target.value)} />
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="space-y-1.5">
          <Label htmlFor="hintText">{t('hintLabel')}</Label>
          <Textarea id="hintText" value={hintText} onChange={(e) => setHintText(e.target.value)} className="resize-none" rows={2} placeholder={t('hintPlaceholder')} />
        </div>

        {/* Explanation */}
        <div className="space-y-1.5">
          <Label htmlFor="explanationText">{t('explanationLabel')}</Label>
          <Textarea id="explanationText" value={explanationText} onChange={(e) => setExplanationText(e.target.value)} className="resize-none" rows={3} placeholder={t('explanationPlaceholder')} />
        </div>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rejectDialog.title')}</DialogTitle>
            <DialogDescription>{t('rejectDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="rejectionReason">{t('rejectDialog.reasonLabel')}</Label>
            <Textarea id="rejectionReason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder={t('rejectDialog.reasonPlaceholder')} className="resize-none" rows={3} />
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
              {t('rejectDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? t('rejectDialog.rejecting') : t('rejectDialog.confirmRejection')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
