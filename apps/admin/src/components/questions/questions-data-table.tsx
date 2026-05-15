'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnDef,
} from '@tanstack/react-table';
import { useTableParams } from '@/hooks/use-table-params';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedQuestionsResult } from '@/app/actions/question-actions';

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  result: PaginatedQuestionsResult;
}

export function QuestionsDataTable<TData, TValue>({ columns, result }: Props<TData, TValue>) {
  "use no memo";

  const { data, page, totalPages, total, pageSize } = result;
  const { pushParams, isPending, sorting, handleSortingChange } = useTableParams();

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is inherently incompatible with React Compiler memoization
  const table = useReactTable({
    data: data as TData[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: handleSortingChange,
    manualSorting: true,
    state: { sorting },
  });

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className={`rounded-md border bg-white transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-500">
                  No questions match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total} questions`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pushParams({ page: String(page - 1) })}
            disabled={page <= 1 || isPending}
            className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => pushParams({ page: String(page + 1) })}
            disabled={page >= totalPages || isPending}
            className={buttonVariants({ variant: 'outline', className: 'h-8 w-8 p-0 disabled:opacity-40' })}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
