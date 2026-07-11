import Link from 'next/link';
import { getPendingQuestions } from '@/app/actions/pending-questions';
import { getCategories } from '@/app/actions/question-actions';
import { ContentReviewPanel } from './content-review-panel';
import { getTranslations } from 'next-intl/server';

type SearchParams = {
  filter?: string;
  page?: string;
};

export default async function ContentReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { filter, page: pageStr } = await searchParams;
  const t = await getTranslations('review');

  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  const [questionsResult, categoriesResult] = await Promise.all([
    getPendingQuestions({ filter, page }),
    getCategories(),
  ]);

  const result = 'data' in questionsResult && 'total' in questionsResult ? questionsResult : { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  const questions = result.data;
  const categories = categoriesResult.success && categoriesResult.data ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('description')}</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <Link href="?" className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${!filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.unvalidated')}
        </Link>
        <Link href="?filter=ai-validated" className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-validated' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.aiValidated')}
        </Link>
        <Link href="?filter=ai-rejected" className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ai-rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.aiRejected')}
        </Link>
        <Link href="?filter=pending-duplicate" className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'pending-duplicate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.pendingDuplicates')}
        </Link>
        <Link href="?filter=rejected" className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('filters.rejected')}
        </Link>
      </div>

      <ContentReviewPanel questions={questions} categories={categories} result={result} filter={filter} />
    </div>
  );
}
