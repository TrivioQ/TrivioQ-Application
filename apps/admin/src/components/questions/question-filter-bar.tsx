'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { ChevronsUpDown, X } from 'lucide-react';
import { DifficultyLevel, AgeRating } from '@trivioq/database';

const DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];
const AGE_RATINGS: AgeRating[] = ['ALL', 'TEEN', 'MATURE'];
const AI_SCORES = [
  { value: 'high', label: 'High (>80)' },
  { value: 'medium', label: 'Medium (50–80)' },
  { value: 'low', label: 'Low (<50)' },
] as const;

type Category = { id: string; name: string };

export function QuestionFilterBar({ categories }: { categories: Category[] }) {
  const t = useTranslations('questions.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Encodes multi-value and single-value updates into the URL, always resetting to page 1
  const push = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', '1');
      Object.entries(updates).forEach(([key, val]) => {
        params.delete(key);
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) return;
        params.set(key, Array.isArray(val) ? val.join(',') : val);
      });
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  const search = searchParams.get('search') ?? '';
  const difficulties = (searchParams.get('difficulty')?.split(',').filter(Boolean) ?? []) as DifficultyLevel[];
  const ageRatings = (searchParams.get('ageRating')?.split(',').filter(Boolean) ?? []) as AgeRating[];
  const categoryNames = searchParams.get('category')?.split(',').filter(Boolean) ?? [];
  const scoreValues = searchParams.get('score')?.split(',').filter(Boolean) ?? [];

  const toggleScore = (s: string) => {
    push({ score: scoreValues.includes(s) ? scoreValues.filter((x) => x !== s) : [...scoreValues, s] });
  };

  const toggleDifficulty = (d: DifficultyLevel) => {
    push({ difficulty: difficulties.includes(d) ? difficulties.filter((x) => x !== d) : [...difficulties, d] });
  };

  const toggleAgeRating = (a: AgeRating) => {
    push({ ageRating: ageRatings.includes(a) ? ageRatings.filter((x) => x !== a) : [...ageRatings, a] });
  };

  const toggleCategory = (name: string) => {
    push({ category: categoryNames.includes(name) ? categoryNames.filter((x) => x !== name) : [...categoryNames, name] });
  };

  const clearAll = () => startTransition(() => router.push(pathname));

  const hasFilters = search || difficulties.length > 0 || ageRatings.length > 0 || categoryNames.length > 0 || scoreValues.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <SearchInput initialValue={search} onDebouncedChange={(val) => push({ search: val || undefined })} placeholder={t('searchQuestionText')} className="w-full sm:w-64 h-9" />

        {/* Difficulty multi-select */}
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}>
            {t('difficulty')}
            {difficulties.length > 0 && <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-teal-600 text-white hover:bg-teal-600">{difficulties.length}</Badge>}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0">
            <Command>
              <CommandList>
                <CommandGroup>
                  {DIFFICULTIES.map((d) => (
                    <CommandItem key={d} onSelect={() => toggleDifficulty(d)} data-checked={difficulties.includes(d)}>
                      {d}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {difficulties.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => push({ difficulty: undefined })} className="justify-center text-center">
                        {t('clearFilters')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Age Rating multi-select */}
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}>
            {t('ageRating')}
            {ageRatings.length > 0 && <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-teal-600 text-white hover:bg-teal-600">{ageRatings.length}</Badge>}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0">
            <Command>
              <CommandList>
                <CommandGroup>
                  {AGE_RATINGS.map((a) => (
                    <CommandItem key={a} onSelect={() => toggleAgeRating(a)} data-checked={ageRatings.includes(a)}>
                      {a}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {ageRatings.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => push({ ageRating: undefined })} className="justify-center text-center">
                        {t('clearFilters')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Category multi-select */}
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}>
            {t('categories')}
            {categoryNames.length > 0 && <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-teal-600 text-white hover:bg-teal-600">{categoryNames.length}</Badge>}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0">
            <Command>
              <CommandInput placeholder={t('searchCategory')} />
              <CommandList>
                <CommandEmpty>{t('noCategoryFound')}</CommandEmpty>
                <CommandGroup>
                  {categories.map((c) => (
                    <CommandItem key={c.id} onSelect={() => toggleCategory(c.name)} data-checked={categoryNames.includes(c.name)}>
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {categoryNames.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => push({ category: undefined })} className="justify-center text-center">
                        {t('clearFilters')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* AI Score multi-select */}
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'h-9 gap-2' })}>
            {t('aiScore')}
            {scoreValues.length > 0 && <Badge className="ml-1 rounded-full px-1.5 py-0 text-xs bg-teal-600 text-white hover:bg-teal-600">{scoreValues.length}</Badge>}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0">
            <Command>
              <CommandList>
                <CommandGroup>
                  {AI_SCORES.map((s) => (
                    <CommandItem key={s.value} onSelect={() => toggleScore(s.value)} data-checked={scoreValues.includes(s.value)}>
                      {s.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {scoreValues.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => push({ score: undefined })} className="justify-center text-center">
                        {t('clearFilters')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <button onClick={clearAll} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <Badge key={d} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleDifficulty(d)}>
              {d} <X className="h-3 w-3" />
            </Badge>
          ))}
          {ageRatings.map((a) => (
            <Badge key={a} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleAgeRating(a)}>
              {a} <X className="h-3 w-3" />
            </Badge>
          ))}
          {categoryNames.map((name) => (
            <Badge key={name} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleCategory(name)}>
              {name} <X className="h-3 w-3" />
            </Badge>
          ))}
          {scoreValues.map((s) => (
            <Badge key={s} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleScore(s)}>
              {AI_SCORES.find((x) => x.value === s)?.label ?? s} <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
