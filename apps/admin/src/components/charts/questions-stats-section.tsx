'use client';

import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { QuestionStats } from '@/app/actions/dashboard-actions';
import { DifficultyChart } from './difficulty-chart';
import { CategoryDifficultyChart } from './category-difficulty-chart';
import { CategoryPopularityChart } from './category-popularity-chart';

interface Props {
  stats: QuestionStats;
}

const DIFFICULTY_BADGE = {
  EASY:   { label: 'Easy',   className: 'bg-green-100 text-green-700' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  HARD:   { label: 'Hard',   className: 'bg-red-100 text-red-700' },
} as const;

export function QuestionsStatsSection({ stats }: Props) {
  const { totalQuestions, byDifficulty, byCategory, byCategoryAndDifficulty } = stats;

  // Shape byCategory into what CategoryPopularityChart expects
  const categoryPopularityData = byCategory.map((c) => ({ name: c.name, questions: c.count }));

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Question Bank</h2>
        <p className="text-sm text-gray-500">
          Total questions and breakdown by difficulty and category
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_1fr]">
        {/* ── Hero / summary card ── */}
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 h-fit">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-100">
                <BookOpen className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700">
                {byCategory.length}{' '}
                {byCategory.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <CardTitle className="mt-3 text-sm font-medium text-gray-600">Total Questions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold text-gray-900 tracking-tight">
              {totalQuestions.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-gray-500">Across all categories</p>

            {/* Per-difficulty mini summary */}
            <div className="mt-4 space-y-2">
              {byDifficulty.map((d) => {
                const cfg = DIFFICULTY_BADGE[d.level];
                return (
                  <div key={d.level} className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {d.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Tabbed chart card ── */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-gray-900">
              Question Breakdown
            </CardTitle>
            <CardDescription>Explore questions by difficulty or category</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="difficulty">
              <TabsList>
                <TabsTrigger value="difficulty">By Difficulty</TabsTrigger>
                <TabsTrigger value="category">By Category</TabsTrigger>
                <TabsTrigger value="combined">Category × Difficulty</TabsTrigger>
              </TabsList>

              {/* Tab 1 — By Difficulty */}
              <TabsContent value="difficulty">
                {byDifficulty.every((d) => d.count === 0) ? (
                  <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
                    No questions yet
                  </div>
                ) : (
                  <DifficultyChart data={byDifficulty} />
                )}
              </TabsContent>

              {/* Tab 2 — By Category */}
              <TabsContent value="category">
                {categoryPopularityData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
                    No categories found
                  </div>
                ) : (
                  <CategoryPopularityChart data={categoryPopularityData} />
                )}
              </TabsContent>

              {/* Tab 3 — Category × Difficulty */}
              <TabsContent value="combined">
                {byCategoryAndDifficulty.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                    No data yet
                  </div>
                ) : (
                  <CategoryDifficultyChart data={byCategoryAndDifficulty} />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
