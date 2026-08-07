'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Play, Square, FastForward, FileText, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CronJobLogsModal } from './cron-job-logs-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  isActive: boolean;
  isExecuting?: boolean;
  nextRunAt: string | null;
}

export function CronJobList() {
  const t = useTranslations('system.cronJobs');
  const confirm = useConfirm();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [logsJobId, setLogsJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/v1/admin/cron-jobs', { signal });
      if (!res.ok) throw new Error('Failed to load cron jobs');
      const data: CronJob[] = await res.json();
      
      if (!signal?.aborted) {
        setJobs(data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (!signal?.aborted) setError(t('loadError'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs(controller.signal);

    const intervalId = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleJobStatus = async (job: CronJob) => {
    if (job.isActive) {
      const ok = await confirm({
        title: t('confirmations.stopTitle'),
        message: t('confirmations.stopMessage', { name: job.name }),
        confirmLabel: t('confirmations.stopConfirm'),
        cancelLabel: t('confirmations.cancel'),
        isDestructive: true,
      });
      if (!ok) return;
    }

    const res = await fetch(`/api/v1/admin/cron-jobs/${job.id}/toggle`, { method: 'POST' });
    if (res.ok) {
      toast.success(t('successToggle'));
      fetchJobs();
    } else {
      toast.error(t('errorAction'));
    }
  };

  const triggerJob = async (job: CronJob) => {
    const ok = await confirm({
      title: t('confirmations.triggerTitle'),
      message: t('confirmations.triggerMessage', { name: job.name }),
      confirmLabel: t('confirmations.triggerConfirm'),
      cancelLabel: t('confirmations.cancel'),
    });
    if (!ok) return;

    const res = await fetch(`/api/v1/admin/cron-jobs/${job.id}/trigger`, { method: 'POST' });
    if (res.ok) {
      toast.success(t('successTrigger'));
      fetchJobs();
    } else {
      toast.error(t('errorAction'));
    }
  };

  const terminateJob = async (job: CronJob) => {
    const ok = await confirm({
      title: t('confirmations.terminateTitle'),
      message: t('confirmations.terminateMessage', { name: job.name }),
      confirmLabel: t('confirmations.terminateConfirm'),
      cancelLabel: t('confirmations.cancel'),
      isDestructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/v1/admin/cron-jobs/${job.id}/terminate`, { method: 'POST' });
    if (res.ok) {
      toast.success(t('successTerminate'));
      fetchJobs();
    } else {
      toast.error(t('errorAction'));
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive py-6 text-center">{error}</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <p className="text-sm">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Card key={job.id} className="bg-background shadow-sm flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4 min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">{job.name}</CardTitle>
                  <CardDescription className="text-xs font-mono bg-muted inline-block px-2 py-0.5 rounded">
                    {job.schedule}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {job.isExecuting && (
                    <Badge variant="destructive" className="animate-pulse bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      {t('statusValues.executing')}
                    </Badge>
                  )}
                  <Badge variant={job.isActive ? 'default' : 'secondary'}>
                    {job.isActive ? t('statusValues.active') : t('statusValues.paused')}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pb-4 flex-1">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('columns.nextRun')}:</span>
                  <span className="font-medium">
                    {job.isActive && job.nextRunAt ? format(new Date(job.nextRunAt), 'PP p') : '—'}
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-0 flex flex-wrap gap-2 border-t mt-4 p-4">
              <Button
                variant={job.isActive ? 'secondary' : 'default'}
                size="sm"
                onClick={() => toggleJobStatus(job)}
                className="flex-1"
              >
                {job.isActive ? (
                  <>
                    <Square className="w-3 h-3 mr-2" />
                    {t('stopJob')}
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-2" />
                    {t('startJob')}
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => triggerJob(job)} className="flex-1">
                <FastForward className="w-3 h-3 mr-2" />
                {t('triggerNow')}
              </Button>
              {job.isExecuting && (
                <Button variant="outline" size="sm" onClick={() => terminateJob(job)} className="flex-1" title={t('terminate')}>
                  <Ban className="w-3 h-3 mr-2 text-destructive" />
                  {t('terminate')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setLogsJobId(job.id)} className="flex-1">
                <FileText className="w-3 h-3 mr-2" />
                {t('viewLogs')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {logsJobId && (
        <CronJobLogsModal
          jobId={logsJobId}
          jobName={jobs.find((j) => j.id === logsJobId)?.name ?? ''}
          onClose={() => setLogsJobId(null)}
        />
      )}
    </div>
  );
}
