import { Suspense } from 'react';
import { getPendingQuestions } from '@/app/actions/pending-questions';
import { getCategories } from '@/app/actions/question-actions';
import { ContentReviewPanel } from './content-review-panel';
import { QuestionFilterBar } from '@/components/questions/question-filter-bar';
import { getTranslations } from 'next-intl/server';
import { DifficultyLevel, AgeRating } from '@trivioq/database';

type SearchParams = {
  filter?: string;
  page?: string;
  pageSize?: string;
  search?: string;
  difficulty?: string | string[];
  ageRating?: string | string[];
  category?: string | string[];
};

export default async function ContentReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = await getTranslations('review');

  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const pageSize = Math.max(1, parseInt(sp.pageSize ?? '25', 10));

  const search = sp.search ?? '';
  const rawDifficulty = Array.isArray(sp.difficulty) ? sp.difficulty.join(',') : (sp.difficulty ?? '');
  const difficulties = rawDifficulty.split(',').filter(Boolean) as DifficultyLevel[];
  const rawAgeRating = Array.isArray(sp.ageRating) ? sp.ageRating.join(',') : (sp.ageRating ?? '');
  const ageRatings = rawAgeRating.split(',').filter(Boolean) as AgeRating[];
  const rawCategory = Array.isArray(sp.category) ? sp.category.join(',') : (sp.category ?? '');
  const categoryFilterNames = rawCategory.split(',').filter(Boolean);

  const categoriesResult = await getCategories();
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : [];

  const categorySlugs = categoryFilterNames.length > 0 ? categories.filter((c) => categoryFilterNames.includes(c.name)).map((c) => c.slug) : [];

  const questionsResult = await getPendingQuestions({ 
    filter: sp.filter, 
    page, 
    pageSize,
    search,
    difficulties,
    ageRatings,
    categorySlugs
  });

  const result = 'data' in questionsResult && 'total' in questionsResult ? questionsResult : { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  const questions = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('description')}</p>
      </div>

      <Suspense>
        <QuestionFilterBar categories={categories} />
      </Suspense>

      <ContentReviewPanel questions={questions} categories={categories} result={result} filter={sp.filter} />
    </div>
  );
}
