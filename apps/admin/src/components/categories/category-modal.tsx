'use client';

import { useState, useTransition } from 'react';
import { createCategory, updateCategory } from '@/app/actions/category.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export function CategoryModal({ category, onOpenChange, open }: { category?: Category | null, onOpenChange?: (open: boolean) => void, open?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  const [prevCategory, setPrevCategory] = useState(category);
  const [prevOpen, setPrevOpen] = useState(dialogOpen);

  if (category !== prevCategory || dialogOpen !== prevOpen) {
    setPrevCategory(category);
    setPrevOpen(dialogOpen);
    if (dialogOpen) {
      setName(category?.name || '');
      setSlug(category?.slug || '');
      setDescription(category?.description || '');
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) setInternalOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!category) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const payload = { name, slug, description: description || undefined };
      
      const res = category 
        ? await updateCategory(category.id, payload)
        : await createCategory(payload);

      if (res.success) {
        handleOpenChange(false);
      } else {
        alert(res.error);
      }
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className={buttonVariants()}>
          Create Category
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Science" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (Unique)</Label>
            <Input id="slug" required value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. science" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief explanation..." />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
