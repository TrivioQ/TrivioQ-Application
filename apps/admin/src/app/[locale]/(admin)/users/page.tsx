import { getUsers } from '@/app/actions/user-actions';
import { columns } from '@/components/users-table/columns';
import { DataTable } from '@/components/users-table/data-table';

export default async function UsersPage() {
  const result = await getUsers();
  const data = result.success && result.data ? result.data : [];

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

      <DataTable columns={columns} data={data} />
    </div>
  );
}
