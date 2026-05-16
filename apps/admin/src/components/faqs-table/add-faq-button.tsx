'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { FAQModal } from './faq-modal';
import { useTranslations } from 'next-intl';

export function AddFAQButton() {
  const t = useTranslations('faqs');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus size={16} />
        <span>{t('addButton')}</span>
      </Button>
      <FAQModal open={open} onOpenChange={setOpen} />
    </>
  );
}
