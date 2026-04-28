import { getCategories } from '@/app/actions/category-actions';
import { columns } from '@/components/categories/columns';
import { DataTable } from '@/components/users-table/data-table';
import { CategoryModal } from '@/components/categories/category-modal';

export default async function CategoriesPage() {
  const result = await getCategories();
  const categories = result.success && result.data ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Categories</h1>
          <p className="text-gray-500 mt-2">
            Manage your trivia categories. Categories organize questions across the application.
          </p>
        </div>
        <CategoryModal />
      </div>

      {result.error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {result.error}
        </div>
      )}

      <DataTable columns={columns} data={categories} />
    </div>
  );
}
