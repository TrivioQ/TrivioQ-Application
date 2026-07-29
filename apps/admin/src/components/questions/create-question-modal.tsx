'use client';

import { useState, useTransition } from 'react';
import { createQuestion } from '@/app/actions/question-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import { DifficultyLevel } from '@trivioq/database';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { toast } from 'sonner';

const DEFAULT_CHOICES = () => [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

export function CreateQuestionModal({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useTranslations('questions.createModal');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [questionText, setQuestionText] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('EASY');
  const [choices, setChoices] = useState(DEFAULT_CHOICES());
  const [hintText, setHintText] = useState('');
  const [explanationText, setExplanationText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Preview toggles
  const [showQuestionPreview, setShowQuestionPreview] = useState(false);
  const [showHintPreview, setShowHintPreview] = useState(false);
  const [showExplanationPreview, setShowExplanationPreview] = useState(false);
  const [choicePreviewIdx, setChoicePreviewIdx] = useState<number | null>(null);

  const markCorrect = (idx: number) => {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === idx })));
  };

  const updateChoiceText = (idx: number, text: string) => {
    setChoices((prev) => prev.map((c, i) => (i === idx ? { ...c, text } : c)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) return toast.error('Select at least one category');

    startTransition(async () => {
      const res = await createQuestion({
        questionText,
        difficultyLevel,
        choices,
        hintText: hintText || undefined,
        explanationText: explanationText || undefined,
        categoryIds: selectedCategories,
      });

      if (res.success) {
        toast.success(t('createSuccess'));
        setOpen(false);
        setQuestionText('');
        setChoices(DEFAULT_CHOICES());
        setHintText('');
        setExplanationText('');
        setSelectedCategories([]);
        setShowQuestionPreview(false);
        setShowHintPreview(false);
        setShowExplanationPreview(false);
        setChoicePreviewIdx(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants()}>{t('trigger')}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">

          {/* Question Text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="question">{t('questionText')} <span className="text-xs text-muted-foreground ml-1">(Markdown supported)</span></Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setShowQuestionPreview((v) => !v)}>
                {showQuestionPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showQuestionPreview ? 'Hide Preview' : 'Preview'}
              </Button>
            </div>
            <Textarea
              id="question"
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t('questionText')}
              className="min-h-[80px] resize-y font-mono text-sm"
            />
            {showQuestionPreview && <MarkdownPreview value={questionText} />}
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label>{t('difficulty')}</Label>
            <AppSelect
              value={difficultyLevel}
              onValueChange={(val) => setDifficultyLevel(val as DifficultyLevel)}
              options={[
                { value: 'EASY', label: t('easy') },
                { value: 'MEDIUM', label: t('medium') },
                { value: 'HARD', label: t('hard') },
              ]}
              placeholder={t('selectDifficulty')}
            />
          </div>

          {/* Choices */}
          <div className="space-y-3">
            <Label>{t('choicesLabel')} <span className="text-xs text-muted-foreground ml-1">(Markdown supported)</span></Label>
            {choices.map((choice, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={choice.isCorrect}
                    title={t('markCorrect')}
                    onClick={() => markCorrect(idx)}
                    className={cn(
                      'h-4 w-4 shrink-0 mt-3.5 rounded-full border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      choice.isCorrect
                        ? 'border-primary bg-primary'
                        : 'border-input hover:border-primary/50 bg-background'
                    )}
                  >
                    {choice.isCorrect && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </button>
                  <div className="flex-1 space-y-1">
                    <div className="flex gap-1">
                      <Textarea
                        required
                        placeholder={t('choicePlaceholder', { number: idx + 1 })}
                        value={choice.text}
                        onChange={(e) => updateChoiceText(idx, e.target.value)}
                        className="min-h-[44px] resize-none font-mono text-sm flex-1"
                        rows={1}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        title="Toggle preview"
                        onClick={() => setChoicePreviewIdx(choicePreviewIdx === idx ? null : idx)}
                      >
                        {choicePreviewIdx === idx ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    {choicePreviewIdx === idx && <MarkdownPreview value={choice.text} compact />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hint">{t('hintLabel')} <span className="text-xs text-muted-foreground ml-1">(Markdown supported)</span></Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setShowHintPreview((v) => !v)}>
                {showHintPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showHintPreview ? 'Hide Preview' : 'Preview'}
              </Button>
            </div>
            <Textarea id="hint" value={hintText} onChange={(e) => setHintText(e.target.value)} placeholder={t('hintPlaceholder')} className="resize-none font-mono text-sm" />
            {showHintPreview && <MarkdownPreview value={hintText} />}
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="explanation">{t('explanationLabel')} <span className="text-xs text-muted-foreground ml-1">(Markdown supported)</span></Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setShowExplanationPreview((v) => !v)}>
                {showExplanationPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showExplanationPreview ? 'Hide Preview' : 'Preview'}
              </Button>
            </div>
            <Textarea id="explanation" value={explanationText} onChange={(e) => setExplanationText(e.target.value)} placeholder={t('explanationPlaceholder')} className="resize-none font-mono text-sm" />
            {showExplanationPreview && <MarkdownPreview value={explanationText} />}
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>{t('categoriesLabel')}</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'w-full justify-between font-normal h-9 px-3 rounded-lg border-input' })} role="combobox" aria-expanded={comboboxOpen}>
                {selectedCategories.length > 0 ? t('categoriesSelected', { count: selectedCategories.length }) : t('selectCategories')}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder={t('searchCategory')} />
                  <CommandList>
                    <CommandEmpty>{t('noCategoryFound')}</CommandEmpty>
                    <CommandGroup>
                      {categories.map((category) => (
                        <CommandItem key={category.id} value={category.id} onSelect={() => toggleCategory(category.id)}>
                          <Check className={cn('mr-2 h-4 w-4', selectedCategories.includes(category.id) ? 'opacity-100' : 'opacity-0')} />
                          {category.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCategories.map((id) => {
                const cat = categories.find((c) => c.id === id);
                return cat ? (
                  <Badge key={id} variant="secondary">
                    {cat.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? t('saving') : t('saveQuestion')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
