'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteFAQ } from '@/app/actions/faq-actions';
import { useState, useTransition } from 'react';
import { FAQModal } from './faq-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';

export type FAQRow = {
  id: string;
  question: string;
  answer: string;
  order: number;
  active: boolean;
};

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

export const columns: ColumnDef<FAQRow>[] = [
  {
    accessorKey: 'order',
    header: ({ column }) => {
      const t = useTranslations('faqs');
      return (
        <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
          {t('columns.order')} <SortIcon sorted={column.getIsSorted()} />
        </button>
      );
    },
  },
  {
    accessorKey: 'question',
    header: ({ column }) => {
      const t = useTranslations('faqs');
      return (
        <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
          {t('columns.question')} <SortIcon sorted={column.getIsSorted()} />
        </button>
      );
    },
    cell: ({ row }) => {
       const question = row.getValue('question') as string;
       return <div className="max-w-[300px] truncate font-medium">{question}</div>;
    }
  },
  {
    accessorKey: 'active',
    header: ({ column }) => {
      const t = useTranslations('faqs');
      return (
        <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
          {t('columns.status')} <SortIcon sorted={column.getIsSorted()} />
        </button>
      );
    },
    cell: ({ row }) => {
      const t = useTranslations('common');
      const active = row.getValue('active') as boolean;
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {active ? t('active') : t('inactive')}
        </span>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const faq = row.original;
      return <FAQActions faq={faq} />;
    },
  },
];

function FAQActions({ faq }: { faq: FAQRow }) {
  const t = useTranslations('faqs');
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirm.title'),
      message: t('deleteConfirm.message'),
      confirmLabel: t('deleteConfirm.confirmLabel'),
      isDestructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteFAQ(faq.id);
      if (!res.success) console.error(res.error);
    });
  };

  return (
    <>
      <FAQModal faq={faq} open={editOpen} onOpenChange={setEditOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })} disabled={isPending}>
          <span className="sr-only">{t('actions.openMenu')}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> {t('actions.editFAQ')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> {t('actions.deleteFAQ')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
