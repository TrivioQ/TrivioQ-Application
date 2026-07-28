'use client';

import { useState, useTransition, useEffect } from 'react';
import { BookOpen, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuestionStats, DifficultyBreakdown } from '@/app/actions/dashboard-actions';
import { getFilteredQuestionStats } from '@/app/actions/dashboard-actions';
import { DifficultyChart } from './difficulty-chart';
import { Badge } from '@/components/ui/badge';
import type { AgeRating } from '@trivioq/database';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useTranslations } from 'next-intl';

interface Props {
  stats: QuestionStats;
}

const DIFFICULTY_BADGE = {
  EASY:   { key: 'easy',   className: 'bg-green-100 text-green-700' },
  MEDIUM: { key: 'medium', className: 'bg-amber-100 text-amber-700' },
  HARD:   { key: 'hard',   className: 'bg-red-100 text-red-700' },
} as const;

export function QuestionsStatsSection({ stats }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAgeRatings, setSelectedAgeRatings] = useState<AgeRating[]>([]);
  const [isPending, startTransition] = useTransition();

  const t = useTranslations('dashboard.questionsExplorer');
  const tq = useTranslations('questions.createModal');

  // Local state for the chart to reflect the filtered data immediately while transitioning
  const [filteredStats, setFilteredStats] = useState<{ totalQuestions: number; byDifficulty: DifficultyBreakdown[] }>({
    totalQuestions: stats.totalQuestions,
    byDifficulty: stats.byDifficulty,
  });

  // Re-fetch when filters change
  useEffect(() => {
    startTransition(async () => {
      const result = await getFilteredQuestionStats({
        categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
        ageRatings: selectedAgeRatings.length > 0 ? selectedAgeRatings : undefined,
      });
      setFilteredStats(result);
    });
  }, [selectedCategories, selectedAgeRatings]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAgeRating = (rating: AgeRating) => {
    setSelectedAgeRatings((prev) =>
      prev.includes(rating) ? prev.filter((r) => r !== rating) : [...prev, rating]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedAgeRatings([]);
  };

  const hasFilters = selectedCategories.length > 0 || selectedAgeRatings.length > 0;

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
        {/* ── Filter / Summary sidebar ── */}
        <div className="space-y-4">
          <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-teal-100">
                  <BookOpen className="h-5 w-5 text-teal-600" />
                </div>
                {hasFilters && (
                  <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer" onClick={clearFilters}>
                    {t('clearFilters')}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3 text-sm font-medium text-muted-foreground">{t('matchingQuestions')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-foreground tracking-tight">
                {isPending ? <span className="animate-pulse">...</span> : filteredStats.totalQuestions.toLocaleString()}
              </div>

              {/* Per-difficulty mini summary */}
              <div className="mt-4 space-y-2">
                {filteredStats.byDifficulty.map((d) => {
                  const cfg = DIFFICULTY_BADGE[d.level];
                  return (
                    <div key={d.level} className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
                        {tq(cfg.key as any)}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {d.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold text-foreground">{t('filters')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 pb-4">
              {/* Category Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('categories')}</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full justify-start font-normal text-sm overflow-hidden text-ellipsis whitespace-nowrap h-9 inline-flex items-center rounded-md border border-border bg-bg px-3 shadow-sm hover:bg-muted focus:outline-none">
                    {selectedCategories.length === 0 
                      ? t('allCategories')
                      : t('categoriesSelected', { count: selectedCategories.length })}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto" align="start">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{t('filterByCategory')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={selectedCategories.length === 0}
                        onCheckedChange={() => setSelectedCategories([])}
                      >
                        {t('allCategories')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {stats.categories.map((c) => (
                        <DropdownMenuCheckboxItem
                          key={c.id}
                          checked={selectedCategories.includes(c.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={() => toggleCategory(c.id)}
                        >
                          {c.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Age Rating Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('ageRating')}</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full justify-start font-normal text-sm overflow-hidden text-ellipsis whitespace-nowrap h-9 inline-flex items-center rounded-md border border-border bg-bg px-3 shadow-sm hover:bg-muted focus:outline-none">
                    {selectedAgeRatings.length === 0 
                      ? t('allRatings') 
                      : t('categoriesSelected', { count: selectedAgeRatings.length })}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{t('filterByRating')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={selectedAgeRatings.length === 0}
                        onCheckedChange={() => setSelectedAgeRatings([])}
                      >
                        {t('allRatings')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {(['ALL', 'TEEN', 'MATURE'] as AgeRating[]).map((r) => (
                        <DropdownMenuCheckboxItem
                          key={r}
                          checked={selectedAgeRatings.includes(r)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={() => toggleAgeRating(r)}
                        >
                          {r === 'ALL' ? t('allAges') : r === 'TEEN' ? t('teen') : t('mature')}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Interactive Chart ── */}
        <Card className="bg-card shadow-sm flex flex-col">
          <CardHeader className="pb-0 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  {t('difficultyDistribution')}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t('difficultyDescription')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-center">
            <div className={`transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
              {filteredStats.byDifficulty.every((d) => d.count === 0) ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                  {t('noQuestionsMatch')}
                </div>
              ) : (
                <div className="h-[320px]">
                  <DifficultyChart data={filteredStats.byDifficulty} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
