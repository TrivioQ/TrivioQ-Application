'use client';

import { useState, useTransition } from 'react';
import { updateQuestion } from '@/app/actions/question-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DifficultyLevel } from '@trivioq/database';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import type { QuestionRow } from './columns';

export function QuestionModal({ 
  question, 
  categories, 
  open, 
  onOpenChange 
}: { 
  question: QuestionRow; 
  categories: { id: string; name: string }[]; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const [isPending, startTransition] = useTransition();

  const [questionText, setQuestionText] = useState(question.questionText);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(question.difficultyLevel);
  const [choices, setChoices] = useState<{ id: string; text: string }[]>(question.choices);
  const [correctAnswerId, setCorrectAnswerId] = useState(question.correctAnswerId);
  const [hintText, setHintText] = useState(question.hintText || '');
  const [explanationText, setExplanationText] = useState(question.explanationText || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(question.categories.map(c => c.id));
  
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Initialize form when question changes or modal opens
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuestionText(question.questionText);
      setDifficultyLevel(question.difficultyLevel);
      setChoices(question.choices);
      setCorrectAnswerId(question.correctAnswerId);
      setHintText(question.hintText || '');
      setExplanationText(question.explanationText || '');
      setSelectedCategories(question.categories.map(c => c.id));
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) return alert('Select at least one category');

    startTransition(async () => {
      const res = await updateQuestion(question.id, {
        questionText,
        difficultyLevel,
        choices,
        correctAnswerId,
        hintText: hintText || undefined,
        explanationText: explanationText || undefined,
        categoryIds: selectedCategories,
      });

      if (res.success) {
        onOpenChange(false);
      } else {
        alert(res.error);
      }
    });
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2">
            <Label htmlFor="question">Question Text</Label>
            <Input id="question" required value={questionText} onChange={e => setQuestionText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={difficultyLevel} onValueChange={(val) => setDifficultyLevel(val as DifficultyLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Choices & Correct Answer</Label>
            {choices.map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="correctAnswer" 
                  checked={correctAnswerId === choice.id} 
                  onChange={() => setCorrectAnswerId(choice.id)}
                  className="h-4 w-4 shrink-0"
                />
                <Input 
                  required 
                  placeholder={`Choice ${idx + 1}`} 
                  value={choice.text}
                  onChange={e => {
                    const newChoices = [...choices];
                    newChoices[idx] = { ...newChoices[idx], text: e.target.value };
                    setChoices(newChoices);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hint">Hint (Optional — costs 30% of points to reveal)</Label>
            <Textarea
              id="hint"
              value={hintText}
              onChange={e => setHintText(e.target.value)}
              placeholder="A clue to help users narrow down the answer..."
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (Optional — shown after answer)</Label>
            <Textarea
              id="explanation"
              value={explanationText}
              onChange={e => setExplanationText(e.target.value)}
              placeholder="Explain why the answer is correct..."
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Categories</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger className={buttonVariants({ variant: "outline", className: "w-full justify-between" })} role="combobox" aria-expanded={comboboxOpen}>
                  {selectedCategories.length > 0 
                    ? `${selectedCategories.length} categories selected` 
                    : "Select categories..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search category..." />
                  <CommandList>
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((category) => (
                        <CommandItem
                          key={category.id}
                          value={category.id}
                          onSelect={() => toggleCategory(category.id)}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedCategories.includes(category.id) ? "opacity-100" : "opacity-0")} />
                          {category.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCategories.map(id => {
                const cat = categories.find(c => c.id === id);
                return cat ? <Badge key={id} variant="secondary">{cat.name}</Badge> : null;
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
