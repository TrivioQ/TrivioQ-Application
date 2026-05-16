import { prisma } from '@trivioq/database';
import Link from 'next/link';
import { JobLogModalTrigger } from '@/components/system/job-log-modal';
import { getTranslations } from 'next-intl/server';

const PAGE_SIZE = 50;

export default async function JobLogsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const t = await getTranslations('system.jobLogs');
  const params = await searchParams;
  const currentPage = Math.max(1, Number(typeof params.page === 'string' ? params.page : '1') || 1);

  const [logs, totalCount] = await Promise.all([
    prisma.jobLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.jobLog.count(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = logs.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('description')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{t('columns.timestamp')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{t('columns.queue')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{t('columns.jobId')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{t('columns.status')}</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap font-mono tabular-nums">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 font-medium">{log.queueName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 font-mono max-w-[220px] truncate" title={log.jobId}>
                      {log.jobId}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {log.status === 'COMPLETED' ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">{t('completed')}</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">{log.status}</span>}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <JobLogModalTrigger payload={log.payload} result={log.result} jobId={log.jobId} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{t('showing', { from, to, totalCount })}</p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={`?page=${currentPage - 1}`} className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                {t('previous')}
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={`?page=${currentPage + 1}`} className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                {t('next')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
