import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuestionStats } from '@/app/actions/dashboard-actions';

interface Props {
  stats: QuestionStats;
}

export function QuestionsStatsSection({ stats }: Props) {
  const { totalQuestions, byCategory } = stats;
  const maxCount = byCategory.reduce((m, c) => Math.max(m, c.count), 0);

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Question Bank</h2>
        <p className="text-sm text-gray-500">Total questions and breakdown by category</p>
      </div>

      {/* Total Questions hero card */}
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 max-w-xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-indigo-100">
              <BookOpen className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700">
              {byCategory.length} {byCategory.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <CardTitle className="mt-3 text-sm font-medium text-gray-600">Total Questions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-3xl font-bold text-gray-900 tracking-tight">
            {totalQuestions.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-gray-500">Across all categories</p>
        </CardContent>
      </Card>

      {/* Per-category grid */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {byCategory.map((cat) => {
            const pct = maxCount > 0 ? Math.round((cat.count / maxCount) * 100) : 0;
            return (
              <Card
                key={cat.id}
                className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 truncate" title={cat.name}>
                    {cat.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {cat.count.toLocaleString()}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {byCategory.length === 0 && (
        <p className="text-sm text-gray-400 italic">No categories found.</p>
      )}
    </div>
  );
}
