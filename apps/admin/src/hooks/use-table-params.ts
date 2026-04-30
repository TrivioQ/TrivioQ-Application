'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SortingState } from '@tanstack/react-table';

export function useTableParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const currentParamsStr = searchParams.toString();
  const [prevParamsStr, setPrevParamsStr] = useState(currentParamsStr);

  // Keep sort arrows in sync with the URL (handles browser back/forward and external clears)
  // We do this during render rather than in useEffect to avoid cascading renders
  if (currentParamsStr !== prevParamsStr) {
    setPrevParamsStr(currentParamsStr);
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder');
    setSorting(sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : []);
  }

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [searchParams, pathname, router]
  );

  const handleSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(next);
      if (next.length > 0) {
        pushParams({ sortBy: next[0].id, sortOrder: next[0].desc ? 'desc' : 'asc', page: '1' });
      } else {
        pushParams({ sortBy: null, sortOrder: null, page: '1' });
      }
    },
    [sorting, pushParams]
  );

  return { pushParams, isPending, sorting, handleSortingChange, searchParams };
}
