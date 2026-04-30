import { Suspense } from 'react';
import { getUsers } from '@/app/actions/user-actions';
import { columns } from '@/components/users-table/columns';
import { DataTable } from '@/components/users-table/data-table';
import { SubscriptionTier } from '@trivioq/database';
import { TierFilter } from '@/components/users-table/tier-filter';

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const tier = typeof params.tier === 'string' ? (params.tier as SubscriptionTier) : undefined;
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'lastLogin';
  const sortOrder = typeof params.sortOrder === 'string' ? (params.sortOrder as 'asc' | 'desc') : 'desc';

  const result = await getUsers({ page, search, tier, sortBy, sortOrder });
  const data = result.success && result.data ? result.data : [];
  const totalPages = result.success && result.totalPages ? result.totalPages : 1;
  const total = result.success && result.total ? result.total : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Users</h1>
        <p className="text-gray-500 mt-2">
          Manage platform users, view their streaks, and modify subscription tiers.
        </p>
      </div>

      {result.error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {result.error}
        </div>
      )}

      <Suspense>
        <DataTable
          columns={columns}
          data={data}
          pageCount={totalPages}
          currentPage={page}
          search={search}
          total={total}
          pageSize={PAGE_SIZE}
          filterSlot={<TierFilter current={tier} />}
        />
      </Suspense>
    </div>
  );
}
