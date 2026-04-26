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
import { deleteFAQ } from '@/app/actions/faq.actions';
import { useState, useTransition } from 'react';
import { FAQModal } from './faq-modal';

export type FAQRow = {
  id: string;
  question: string;
  answer: string;
  order: number;
  active: boolean;
};

export const columns: ColumnDef<FAQRow>[] = [
  {
    accessorKey: 'order',
    header: 'Order',
  },
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
       const question = row.getValue('question') as string;
       return <div className="max-w-[300px] truncate font-medium">{question}</div>;
    }
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => {
      const active = row.getValue('active') as boolean;
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {active ? 'Active' : 'Inactive'}
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
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this FAQ? This action cannot be undone.`)) {
      startTransition(async () => {
        const res = await deleteFAQ(faq.id);
        if (!res.success) alert(res.error);
      });
    }
  };

  return (
    <>
      <FAQModal faq={faq} open={editOpen} onOpenChange={setEditOpen} />

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
              <Pencil className="mr-2 h-4 w-4" /> Edit FAQ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> Delete FAQ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
