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
import { Badge } from '@/components/ui/badge';
import { DifficultyLevel } from '@trivioq/database';
import { deleteQuestion, getCategories } from '@/app/actions/question-actions';
import { useState, useTransition, useEffect } from 'react';
import { QuestionModal } from './question-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';

export type QuestionRow = {
  id: string;
  questionText: string;
  difficultyLevel: DifficultyLevel;
  categories: { id: string; name: string }[];
  choices: { id: string; text: string; order: number; isCorrect: boolean }[];
  explanationText: string | null;
  hintText: string | null;
};

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

export const columns: ColumnDef<QuestionRow>[] = [
  {
    accessorKey: 'questionText',
    header: ({ column }) => {
      const t = useTranslations('questions');
      return (
        <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
          {t('columns.question')} <SortIcon sorted={column.getIsSorted()} />
        </button>
      );
    },
    cell: ({ row }) => {
      const text = row.getValue('questionText') as string;
      return <div className="max-w-[400px] truncate" title={text}>{text}</div>;
    },
  },
  {
    accessorKey: 'difficultyLevel',
    header: ({ column }) => {
      const t = useTranslations('questions');
      return (
        <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
          {t('columns.difficulty')} <SortIcon sorted={column.getIsSorted()} />
        </button>
      );
    },
    cell: ({ row }) => {
      const diff = row.getValue('difficultyLevel') as string;
      const colors: Record<string, string> = {
        EASY: 'bg-green-100 text-green-800 hover:bg-green-100',
        MEDIUM: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
        HARD: 'bg-red-100 text-red-800 hover:bg-red-100',
      };
      return <Badge className={colors[diff] || 'bg-gray-100 text-gray-800'}>{diff}</Badge>;
    },
  },
  {
    accessorKey: 'categories',
    header: () => {
      const t = useTranslations('questions');
      return <>{t('columns.categories')}</>;
    },
    cell: ({ row }) => {
      const t = useTranslations('common');
      const categories = row.original.categories;
      if (!categories || categories.length === 0) return <span className="text-gray-400">{t('none')}</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <Badge key={c.id} variant="outline" className="text-xs">
              {c.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <QuestionActions question={row.original} />,
  },
];

function QuestionActions({ question }: { question: QuestionRow }) {
  const t = useTranslations('questions');
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const confirm = useConfirm();

  useEffect(() => {
    if (editOpen && categories.length === 0) {
      getCategories().then(res => {
        if (res.success && res.data) setCategories(res.data);
      });
    }
  }, [editOpen, categories.length]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirm.title'),
      message: t('deleteConfirm.message'),
      confirmLabel: t('deleteConfirm.confirmLabel'),
      isDestructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteQuestion(question.id);
      if (!res.success) console.error(res.error);
    });
  };

  return (
    <>
      <QuestionModal
        question={question}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
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
              <Pencil className="mr-2 h-4 w-4" /> {t('actions.editQuestion')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> {t('actions.deleteQuestion')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
