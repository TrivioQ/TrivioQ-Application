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
import { Badge } from '@/components/ui/badge';
import { DifficultyLevel } from '@trivioq/database';
import { useState, useTransition } from 'react';
import { deleteQuestion } from '@/app/actions/question.actions';
import { QuestionModal } from './question-modal';

export type QuestionRow = {
  id: string;
  questionText: string;
  difficultyLevel: DifficultyLevel;
  categories: { id: string; name: string }[];
  choices: unknown;
  correctAnswerId: string;
};

export function createColumns(categories: { id: string; name: string }[]): ColumnDef<QuestionRow>[] {
  return [
    {
      accessorKey: 'questionText',
      header: 'Question',
      cell: ({ row }) => {
        const text = row.getValue('questionText') as string;
        return <div className="max-w-[400px] truncate" title={text}>{text}</div>;
      },
    },
    {
      accessorKey: 'difficultyLevel',
      header: 'Difficulty',
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
      header: 'Categories',
      cell: ({ row }) => {
        const cats = row.original.categories;
        if (!cats || cats.length === 0) return <span className="text-gray-400">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
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
      cell: ({ row }) => <QuestionActions question={row.original} categories={categories} />,
    },
  ];
}

function QuestionActions({ question, categories }: { question: QuestionRow; categories: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this question? This action cannot be undone.`)) {
      startTransition(async () => {
        const res = await deleteQuestion(question.id);
        if (!res.success) alert(res.error);
      });
    }
  };

  return (
    <>
      <QuestionModal question={question} categories={categories} open={editOpen} onOpenChange={setEditOpen} />

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
              <Pencil className="mr-2 h-4 w-4" /> Edit Question
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> Delete Question
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
