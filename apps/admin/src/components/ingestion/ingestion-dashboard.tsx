'use client';

import { useEffect, useState, useCallback } from 'react';
import { Play, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface IngestionJob {
  id: string;
  processType: string;
  status: string;
  progress: number;
  overallProgress: number;
  currentPhase: string | null;
  fileName: string;
  totalQuestions: number;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isStale(job: IngestionJob): boolean {
  if (job.status !== 'PROCESSING') return false;
  const ref = job.lastHeartbeatAt ?? job.updatedAt;
  return Date.now() - new Date(ref).getTime() > STALE_THRESHOLD_MS;
}

export function IngestionDashboard() {
  const t = useTranslations('system.ingestion');
  const confirm = useConfirm();
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/v1/admin/ingestion/jobs', { signal });
      if (!res.ok) throw new Error('Failed to load ingestion jobs');
      const data = await res.json();
      
      if (!signal?.aborted) {
        setJobs(data.data);
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
    }, 5000); // refresh every 5s for progress

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchJobs]);

  const deleteJob = async (job: IngestionJob) => {
    const ok = await confirm({
      title: t('confirmations.deleteTitle'),
      message: t('confirmations.deleteMessage'),
      confirmLabel: t('confirmations.deleteConfirm'),
      cancelLabel: t('confirmations.cancel'),
      isDestructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/v1/admin/ingestion/jobs/${job.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Job deleted');
      fetchJobs();
    } else {
      toast.error(t('errorAction'));
    }
  };

  const retryJob = async (job: IngestionJob, phaseToForce: string) => {
    const ok = await confirm({
      title: t('confirmations.retryTitle'),
      message: t('confirmations.retryMessage'),
      confirmLabel: t('confirmations.retryConfirm'),
      cancelLabel: t('confirmations.cancel'),
    });
    if (!ok) return;

    const payload: Record<string, string> = {};
    if (phaseToForce !== 'none') payload.forcePhase = phaseToForce;

    const res = await fetch(`/api/v1/admin/ingestion/jobs/${job.id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(t('retryQueued'));
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <Card key={job.id} className="bg-background shadow-sm flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <CardTitle className="text-base font-semibold truncate" title={job.fileName}>
                  {job.fileName}
                </CardTitle>
                <div className="flex flex-col gap-1.5 items-start">
                  <CardDescription className="text-xs font-mono bg-muted inline-block px-2 py-0.5 rounded">
                    {job.processType === 'QUIZ_GENERATION' ? t('form.quizGeneration') : job.processType === 'QUESTION_EXTRACTION' ? t('form.questionExtraction') : job.processType}
                  </CardDescription>
                  <CardDescription className="text-xs font-mono truncate w-full" title={job.id}>
                    {t('idLabel', { id: job.id })}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isStale(job) && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500 flex items-center gap-1" title={t('staleWarning')}>
                    <AlertTriangle className="h-3 w-3" />
                  </Badge>
                )}
                {job.status === 'PROCESSING' && !isStale(job) ? (
                  <Badge className="animate-pulse bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    {job.status}
                  </Badge>
                ) : (
                  <Badge variant={job.status === 'FAILED' ? 'destructive' : job.status === 'COMPLETED' ? 'default' : 'secondary'}>
                    {job.status}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-4 flex-1">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('phase')}:</span>
                <span className="font-medium">{job.currentPhase || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('questions')}:</span>
                <span className="font-medium">{job.totalQuestions}</span>
              </div>

              {/* Overall Progress */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('overallProgress')}</span>
                  <span className="font-medium">{job.overallProgress}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-in-out"
                    style={{ width: `${job.overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Phase Progress — only while actively processing */}
              {job.status === 'PROCESSING' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('progress')}</span>
                    <span className="font-medium">{job.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary/60 h-full transition-all duration-500 ease-in-out"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-0 flex flex-wrap gap-2 border-t mt-4 p-4">
            <Button variant="default" size="sm" className="flex-1" render={<Link href={`/ingestion/${job.id}`} />}>
              <Eye className="w-3 h-3 mr-2" />
              {t('viewDetails')}
            </Button>
            
            {job.status === 'FAILED' || job.status === 'COMPLETED' ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="flex-1" />}>
                  <Play className="w-3 h-3 mr-2" />
                  {t('retryJob')}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => retryJob(job, 'none')}>
                    {t('phases.none')}
                  </DropdownMenuItem>
                  {job.processType !== 'QUIZ_GENERATION' && (
                    <DropdownMenuItem onClick={() => retryJob(job, 'SCOUT')}>
                      {t('phases.scout')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => retryJob(job, 'EXTRACTION')}>
                    {t('phases.extraction')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => retryJob(job, 'ENHANCEMENT')}>
                    {t('phases.enhancement')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => retryJob(job, 'UPLOAD')}>
                    {t('phases.upload')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button variant="outline" size="sm" onClick={() => deleteJob(job)} className="flex-1" title={t('deleteJob')}>
              <Trash2 className="w-3 h-3 mr-2 text-destructive" />
              {t('deleteJob')}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
