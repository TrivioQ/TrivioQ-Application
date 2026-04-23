'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DifficultyLevel } from '@trivioq/database';

export type QuestionRow = {
  id: string;
  questionText: string;
  difficultyLevel: DifficultyLevel;
  categories: { id: string; name: string }[];
};

export const columns: ColumnDef<QuestionRow>[] = [
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
      const categories = row.original.categories;
      if (!categories || categories.length === 0) return <span className="text-gray-400">None</span>;
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
];
