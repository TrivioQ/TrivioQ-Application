import { Suspense } from 'react';
import { getCategories } from '@/app/actions/category-actions';
import { columns } from '@/components/categories/columns';
import { DataTable } from '@/components/users-table/data-table';
import { CategoryModal } from '@/components/categories/category-modal';

const PAGE_SIZE = 20;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'name';
  const sortOrder = typeof params.sortOrder === 'string' ? (params.sortOrder as 'asc' | 'desc') : 'asc';

  const result = await getCategories({ page, search, sortBy, sortOrder });
  const categories = result.success && result.data ? result.data : [];
  const totalPages = result.success && result.totalPages ? result.totalPages : 1;

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

      <Suspense>
        <DataTable
          columns={columns}
          data={categories}
          pageCount={totalPages}
          currentPage={page}
          search={search}
          total={result.success ? result.total : undefined}
          pageSize={PAGE_SIZE}
        />
      </Suspense>
    </div>
  );
}
