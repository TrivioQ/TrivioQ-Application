import { prisma } from '@trivioq/database';
import Link from 'next/link';
import { JobLogModalTrigger } from '@/components/system/job-log-modal';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{t('columns.timestamp')}</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{t('columns.queue')}</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{t('columns.jobId')}</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{t('columns.status')}</th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-3 text-sm text-foreground whitespace-nowrap font-mono tabular-nums">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-foreground font-medium">{log.queueName}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground font-mono max-w-[220px] truncate" title={log.jobId}>
                      {log.jobId}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {log.status === 'COMPLETED' ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 ring-1 ring-inset ring-green-500/20">{t('completed')}</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 ring-1 ring-inset ring-red-500/20">{log.status}</span>}
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
          <p className="text-sm text-muted-foreground">{t('showing', { from, to, totalCount })}</p>
          <div className="flex gap-2 items-center">
            {currentPage > 1 ? (
              <>
                <Link href={'?page=1'} className="inline-flex items-center justify-center w-8 h-8 text-foreground bg-background border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ChevronsLeft className="w-4 h-4" />
                </Link>
                <Link href={`?page=${currentPage - 1}`} className="inline-flex items-center justify-center w-8 h-8 text-foreground bg-background border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-8 h-8 text-foreground/40 bg-background border border-border rounded-lg cursor-not-allowed opacity-50">
                  <ChevronsLeft className="w-4 h-4" />
                </div>
                <div className="inline-flex items-center justify-center w-8 h-8 text-foreground/40 bg-background border border-border rounded-lg cursor-not-allowed opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </>
            )}
            <span className="text-sm text-muted-foreground font-medium px-2">
              {totalCount === 0 ? 0 : currentPage} / {totalCount === 0 ? 0 : totalPages}
            </span>
            {currentPage < totalPages ? (
              <>
                <Link href={`?page=${currentPage + 1}`} className="inline-flex items-center justify-center w-8 h-8 text-foreground bg-background border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link href={`?page=${totalPages}`} className="inline-flex items-center justify-center w-8 h-8 text-foreground bg-background border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ChevronsRight className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-8 h-8 text-foreground/40 bg-background border border-border rounded-lg cursor-not-allowed opacity-50">
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div className="inline-flex items-center justify-center w-8 h-8 text-foreground/40 bg-background border border-border rounded-lg cursor-not-allowed opacity-50">
                  <ChevronsRight className="w-4 h-4" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
