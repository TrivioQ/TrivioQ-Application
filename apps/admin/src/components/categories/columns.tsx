'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
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
import { deleteCategory } from '@/app/actions/category-actions';
import { useState, useTransition } from 'react';
import { Category, CategoryModal } from './category-modal';

type CategoryRow = Category & {
  _count: {
    questions: number;
  };
};

export const columns: ColumnDef<CategoryRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => row.getValue('description') || <span className="text-gray-400">None</span>,
  },
  {
    id: 'questionsCount',
    header: 'Questions',
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
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${category.name}"? Questions in this category will not be deleted, but will be removed from this category.`)) {
      startTransition(async () => {
        const res = await deleteCategory(category.id);
        if (!res.success) alert(res.error);
      });
    }
  };

  return (
    <>
      <CategoryModal category={category} open={editOpen} onOpenChange={setEditOpen} />
      
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })} disabled={isPending}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> Edit Category
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> Delete Category
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
