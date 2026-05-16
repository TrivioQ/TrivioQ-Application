'use client';

import { ColumnDef, Column } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { deleteCategory } from '@/app/actions/category-actions';
import { useState, useTransition } from 'react';
import { Category, CategoryModal } from './category-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';

type CategoryRow = Category & {
  _count: {
    questions: number;
  };
};

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

function SortableColumnHeader({ column, children }: { column: Column<CategoryRow, unknown>; children: React.ReactNode }) {
  return (
    <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
      {children} <SortIcon sorted={column.getIsSorted()} />
    </button>
  );
}

function NameHeader({ column }: { column: Column<CategoryRow, unknown> }) {
  const t = useTranslations('categories');
  return <SortableColumnHeader column={column}>{t('columns.name')}</SortableColumnHeader>;
}

function SlugHeader({ column }: { column: Column<CategoryRow, unknown> }) {
  const t = useTranslations('categories');
  return <SortableColumnHeader column={column}>{t('columns.slug')}</SortableColumnHeader>;
}

function DescriptionHeader() {
  const t = useTranslations('categories');
  return <>{t('columns.description')}</>;
}

function DescriptionCell({ value }: { value: unknown }) {
  const t = useTranslations('categories');
  return <>{value || <span className="text-gray-400">{t('columns.none')}</span>}</>;
}

function QuestionsHeader() {
  const t = useTranslations('categories');
  return <>{t('columns.questions')}</>;
}

export const columns: ColumnDef<CategoryRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <NameHeader column={column} />,
  },
  {
    accessorKey: 'slug',
    header: ({ column }) => <SlugHeader column={column} />,
  },
  {
    accessorKey: 'description',
    header: () => <DescriptionHeader />,
    cell: ({ row }) => <DescriptionCell value={row.getValue('description')} />,
  },
  {
    id: 'questionsCount',
    header: () => <QuestionsHeader />,
    cell: ({ row }) => row.original._count.questions,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const category = row.original;
      return <CategoryActions category={category} />;
    },
  },
];

function CategoryActions({ category }: { category: CategoryRow }) {
  const t = useTranslations('categories');
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirm.title', { name: category.name }),
      message: t('deleteConfirm.message'),
      confirmLabel: t('deleteConfirm.confirmLabel'),
      isDestructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (!res.success) console.error(res.error);
    });
  };

  return (
    <>
      <CategoryModal category={category} open={editOpen} onOpenChange={setEditOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'h-8 w-8 p-0' })} disabled={isPending}>
          <span className="sr-only">{t('actions.openMenu')}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> {t('actions.editCategory')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> {t('actions.deleteCategory')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
