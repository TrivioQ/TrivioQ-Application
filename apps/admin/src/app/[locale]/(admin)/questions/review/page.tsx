import Link from 'next/link';
import { getPendingQuestions } from '@/app/actions/pending-questions';
import { getCategories } from '@/app/actions/question-actions';
import { ContentReviewPanel } from './content-review-panel';

export default async function ContentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const [questionsResult, categoriesResult] = await Promise.all([
    getPendingQuestions(filter),
    getCategories(),
  ]);

  const questions = questionsResult.success && questionsResult.data ? questionsResult.data : [];
  const categories =
    categoriesResult.success && categoriesResult.data ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Content Review</h1>
        <p className="text-gray-500 mt-2">
          Review and approve AI-generated trivia questions before they enter the live database.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <Link
          href="?"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter !== 'ai-validated'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Unvalidated
        </Link>
        <Link
          href="?filter=ai-validated"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === 'ai-validated'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          AI Validated
        </Link>
      </div>

      <ContentReviewPanel questions={questions} categories={categories} />
    </div>
  );
}
