'use client';

import { useState, useTransition } from 'react';
import { createFAQ, updateFAQ } from '@/app/actions/faq-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
  active: boolean;
}

interface FAQModalProps {
  faq?: FAQ;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FAQModal({ faq, open, onOpenChange }: FAQModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const question = formData.get('question') as string;
    const answer = formData.get('answer') as string;
    const order = parseInt(formData.get('order') as string) || 0;
    const active = formData.get('active') === 'on';

    startTransition(async () => {
      const res = faq 
        ? await updateFAQ(faq.id, { question, answer, order, active })
        : await createFAQ({ question, answer, order, active });

      if (res.success) {
        onOpenChange(false);
      } else {
        setError(res.error || 'Failed to save FAQ');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{faq ? 'Edit FAQ' : 'Add New FAQ'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              name="question"
              defaultValue={faq?.question}
              placeholder="e.g. How do I earn points?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              name="answer"
              defaultValue={faq?.answer}
              placeholder="The answer text..."
              className="min-h-[100px]"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                name="order"
                type="number"
                defaultValue={faq?.order ?? 0}
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <input
                id="active"
                name="active"
                type="checkbox"
                defaultChecked={faq?.active ?? true}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save FAQ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
