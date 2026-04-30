'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { FAQModal } from './faq-modal';

export function AddFAQButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus size={16} />
        <span>Add FAQ</span>
      </Button>
      <FAQModal open={open} onOpenChange={setOpen} />
    </>
  );
}
