import { getFAQs } from '@/app/actions/faq-actions';
import { columns } from '@/components/faqs-table/columns';
import { DataTable } from '@/components/faqs-table/data-table';

export default async function FAQsPage() {
  const result = await getFAQs();
  const data = result.success && result.data ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">FAQs</h1>
        <p className="text-gray-500 mt-2">
          Manage the frequently asked questions displayed in the web application.
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
