import { Suspense } from 'react';
import { getQuestions, getCategories } from '@/app/actions/question-actions';
import { columns } from '@/components/questions/columns';
import { CreateQuestionModal } from '@/components/questions/create-question-modal';
import { QuestionFilterBar } from '@/components/questions/question-filter-bar';
import { QuestionsDataTable } from '@/components/questions/questions-data-table';
import { DifficultyLevel } from '@trivioq/database';

type SearchParams = {
  page?: string;
  search?: string;
  difficulty?: string | string[];
  category?: string | string[];
  sortBy?: string;
  sortOrder?: string;
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const search = sp.search ?? '';
  const rawDifficulty = Array.isArray(sp.difficulty) ? sp.difficulty.join(',') : (sp.difficulty ?? '');
  const difficulties = (rawDifficulty.split(',').filter(Boolean)) as DifficultyLevel[];
  const rawCategory = Array.isArray(sp.category) ? sp.category.join(',') : (sp.category ?? '');
  const categoryFilterNames = rawCategory.split(',').filter(Boolean);

  const sortBy = typeof sp.sortBy === 'string' ? sp.sortBy : 'id';
  const sortOrder = typeof sp.sortOrder === 'string' ? (sp.sortOrder as 'asc' | 'desc') : 'desc';

  const categoriesResult = await getCategories();
  const categories =
    categoriesResult.success && categoriesResult.data ? categoriesResult.data : [];

  const categoryIds = categoryFilterNames.length > 0
    ? categories.filter((c) => categoryFilterNames.includes(c.name)).map((c) => c.id)
    : [];

  const result = await getQuestions({ page, search, difficulties, categoryIds, sortBy, sortOrder });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Questions</h1>
          <p className="text-gray-500 mt-2">
            Manage your trivia database. Filter by category, difficulty, or search text.
          </p>
        </div>
        <CreateQuestionModal categories={categories} />
      </div>

      {/* Filter bar — needs Suspense because it calls useSearchParams */}
      <Suspense>
        <QuestionFilterBar categories={categories} />
      </Suspense>

      {/* Table + Pagination — also needs Suspense */}
      <Suspense>
        <QuestionsDataTable columns={columns} result={result} />
      </Suspense>
    </div>
  );
}
