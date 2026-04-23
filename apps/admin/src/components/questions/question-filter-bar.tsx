'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DifficultyLevel } from '@trivioq/database';

const DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

type Category = { id: string; name: string };

export function QuestionFilterBar({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const push = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Always reset to page 1 when a filter changes
      params.set('page', '1');

      Object.entries(updates).forEach(([key, val]) => {
        params.delete(key);
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) return;
        if (Array.isArray(val)) {
          val.forEach((v) => params.append(key, v));
        } else {
          params.set(key, val);
        }
      });

      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams]
  );

  // ── Read current filter state from URL ──
  const search = searchParams.get('search') ?? '';
  const difficulties = searchParams.getAll('difficulty') as DifficultyLevel[];
  const categoryIds = searchParams.getAll('category');

  const toggleDifficulty = (d: DifficultyLevel) => {
    const next = difficulties.includes(d)
      ? difficulties.filter((x) => x !== d)
      : [...difficulties, d];
    push({ difficulty: next });
  };

  const toggleCategory = (id: string) => {
    const next = categoryIds.includes(id)
      ? categoryIds.filter((x) => x !== id)
      : [...categoryIds, id];
    push({ category: next });
  };

  const clearAll = () => {
    startTransition(() => router.push(pathname));
  };

  const hasFilters = search || difficulties.length > 0 || categoryIds.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        {/* ── Text Search ── */}
        <Input
          id="question-search"
          placeholder="Search question text…"
          defaultValue={search}
          className="h-9 w-64 bg-white"
          onChange={(e) => {
            const val = e.target.value;
            // Debounce slightly to avoid thrashing
            const timeout = setTimeout(() => push({ search: val }), 350);
            return () => clearTimeout(timeout);
          }}
        />

        {/* ── Difficulty Multi-Select ── */}
        <Popover>
          <PopoverTrigger
            className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}
          >
            Difficulty
            {difficulties.length > 0 && (
              <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-indigo-600 text-white hover:bg-indigo-600">
                {difficulties.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-44 p-0">
            <Command>
              <CommandList>
                <CommandGroup>
                  {DIFFICULTIES.map((d) => (
                    <CommandItem key={d} onSelect={() => toggleDifficulty(d)}>
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          difficulties.includes(d) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {d}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* ── Category Multi-Select ── */}
        <Popover>
          <PopoverTrigger
            className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}
          >
            Categories
            {categoryIds.length > 0 && (
              <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-indigo-600 text-white hover:bg-indigo-600">
                {categoryIds.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Search category…" />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup>
                  {categories.map((c) => (
                    <CommandItem key={c.id} onSelect={() => toggleCategory(c.id)}>
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          categoryIds.includes(c.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* ── Clear All ── */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* ── Active filter badges ── */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <Badge
              key={d}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleDifficulty(d)}
            >
              {d} <X className="h-3 w-3" />
            </Badge>
          ))}
          {categoryIds.map((id) => {
            const cat = categories.find((c) => c.id === id);
            return cat ? (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => toggleCategory(id)}
              >
                {cat.name} <X className="h-3 w-3" />
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
