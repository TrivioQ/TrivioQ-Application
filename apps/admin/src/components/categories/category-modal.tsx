'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createCategory, updateCategory } from '@/app/actions/category-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export function CategoryModal({ category, onOpenChange, open }: { category?: Category | null; onOpenChange?: (open: boolean) => void; open?: boolean }) {
  const t = useTranslations('categories');
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
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, ''),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const payload = { name, slug, description: description || undefined };

      const res = category ? await updateCategory(category.id, payload) : await createCategory(payload);

      if (res.success) {
        toast.success(category ? t('editModal.saveSuccess') : t('createModal.createSuccess'));
        handleOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {!isControlled && <DialogTrigger className={buttonVariants()}>{t('createModal.trigger')}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{category ? t('editModal.title') : t('createModal.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('createModal.name')}</Label>
            <Input id="name" required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder={t('createModal.namePlaceholder')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">{t('createModal.slug')}</Label>
            <Input id="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('createModal.slugPlaceholder')} disabled={!!category} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('createModal.description')}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('createModal.descriptionPlaceholder')} />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? t('createModal.saving') : t('createModal.saveCategory')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
