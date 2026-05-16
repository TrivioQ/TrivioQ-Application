import { Suspense } from 'react';
import { getFAQs } from '@/app/actions/faq-actions';
import { columns } from '@/components/faqs-table/columns';
import { DataTable } from '@/components/users-table/data-table';
import { FaqStatusFilter } from '@/components/faqs-table/faq-status-filter';
import { AddFAQButton } from '@/components/faqs-table/add-faq-button';
import { getTranslations } from 'next-intl/server';

const PAGE_SIZE = 20;

export default async function FAQsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const t = await getTranslations('faqs');
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'order';
  const sortOrder = typeof params.sortOrder === 'string' ? (params.sortOrder as 'asc' | 'desc') : 'asc';
  const active = params.active === 'true' ? true : params.active === 'false' ? false : undefined;

  const result = await getFAQs({ page, search, sortBy, sortOrder, active });
  const data = result.success && result.data ? result.data : [];
  const totalPages = result.success && result.totalPages ? result.totalPages : 1;
  const total = result.success ? result.total : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('description')}</p>
      </div>

      {result.error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{result.error}</div>}

      <Suspense>
        <DataTable columns={columns} data={data} pageCount={totalPages} currentPage={page} search={search} total={total} pageSize={PAGE_SIZE} searchPlaceholder={t('searchPlaceholder')} filterSlot={<FaqStatusFilter current={active} />} actionSlot={<AddFAQButton />} />
      </Suspense>
    </div>
  );
}
