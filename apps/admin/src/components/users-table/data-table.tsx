'use client';

import { flexRender, getCoreRowModel, useReactTable, ColumnDef } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SearchInput } from '@/components/ui/search-input';
import { useTableParams } from '@/hooks/use-table-params';
import { useTranslations } from 'next-intl';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  currentPage?: number;
  search?: string;
  total?: number;
  pageSize?: number;
  /** Extra filter controls rendered beside the search box (e.g. TierFilter) */
  filterSlot?: React.ReactNode;
  /** Action button(s) rendered on the right of the toolbar (e.g. "Add FAQ") */
  actionSlot?: React.ReactNode;
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({ columns, data, pageCount = 1, currentPage = 1, search = '', total, pageSize = 20, filterSlot, actionSlot, searchPlaceholder }: DataTableProps<TData, TValue>) {
  'use no memo';

  const t = useTranslations('common');
  const { pushParams, isPending, sorting, handleSortingChange } = useTableParams();

  const placeholder = searchPlaceholder ?? t('searchPlaceholder');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: handleSortingChange,
    manualSorting: true,
    manualPagination: true,
    pageCount,
    state: { sorting },
  });

  const start = total ? (currentPage - 1) * pageSize + 1 : null;
  const end = total ? Math.min(currentPage * pageSize, total) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput initialValue={search} onDebouncedChange={(val) => pushParams({ search: val || null, page: '1' })} placeholder={placeholder} className="w-full sm:w-64" />
          {filterSlot}
        </div>
        {actionSlot}
      </div>

      <div className={`overflow-x-auto rounded-md border bg-background transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
        <Table className="min-w-[600px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{start && end && total ? t('showing', { from: start, to: end, total }) : t('pageOf', { current: data.length === 0 ? 0 : currentPage, total: data.length === 0 ? 0 : Math.max(1, pageCount) })}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8 w-8 p-0" onClick={() => pushParams({ page: '1' })} disabled={currentPage <= 1 || isPending}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-8 w-8 p-0" onClick={() => pushParams({ page: String(currentPage - 1) })} disabled={currentPage <= 1 || isPending}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground font-medium px-2">
            {data.length === 0 ? 0 : currentPage} / {data.length === 0 ? 0 : Math.max(1, pageCount)}
          </span>
          <Button variant="outline" className="h-8 w-8 p-0" onClick={() => pushParams({ page: String(currentPage + 1) })} disabled={currentPage >= pageCount || isPending}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-8 w-8 p-0" onClick={() => pushParams({ page: String(Math.max(1, pageCount)) })} disabled={currentPage >= pageCount || isPending}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
