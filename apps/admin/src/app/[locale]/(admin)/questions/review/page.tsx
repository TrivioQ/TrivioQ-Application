import { getPendingQuestions } from '@/app/actions/pending-questions';
import { getCategories } from '@/app/actions/question-actions';
import { ContentReviewPanel } from './content-review-panel';

export default async function ContentReviewPage() {
  const [questionsResult, categoriesResult] = await Promise.all([
    getPendingQuestions(),
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

      <ContentReviewPanel questions={questions} categories={categories} />
    </div>
  );
}
