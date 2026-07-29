'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Execution {
  id: string;
  startedAt: string;
  endedAt: string | null;
  result: 'SUCCESS' | 'FAILED' | 'TERMINATED' | 'RUNNING';
  error: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface CronJobLogsModalProps {
  jobId: string;
  jobName: string;
  onClose: () => void;
}

export function CronJobLogsModal({ jobId, jobName, onClose }: CronJobLogsModalProps) {
  const t = useTranslations('cronJobs');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/cron-jobs/${jobId}/executions?page=${page}`);
        if (!res.ok) throw new Error('Failed to load execution logs');
        const data = await res.json();
        if (!cancelled) {
          setExecutions(data.executions);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [jobId, page]);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'SUCCESS':
        return <Badge variant="default" className="bg-green-600">{t('resultValues.success')}</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">{t('resultValues.failed')}</Badge>;
      case 'TERMINATED':
        return <Badge variant="secondary">{t('resultValues.terminated')}</Badge>;
      case 'RUNNING':
        return <Badge variant="outline" className="border-blue-500 text-blue-500 animate-pulse">{t('statusValues.running')}</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('logsModal.title', { name: jobName })}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('logsModal.loading')}</div>
          ) : executions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('logsModal.empty')}</div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>{t('logsModal.columns.startedAt')}</TableHead>
                    <TableHead>{t('logsModal.columns.endedAt')}</TableHead>
                    <TableHead>{t('logsModal.columns.result')}</TableHead>
                    <TableHead>{t('logsModal.columns.error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(exec.startedAt), 'PP p')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {exec.endedAt ? format(new Date(exec.endedAt), 'PP p') : '—'}
                      </TableCell>
                      <TableCell>
                        {getResultBadge(exec.result)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={exec.error || ''}>
                        {exec.error ? (
                          <span className="text-destructive text-sm font-mono">{exec.error}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
