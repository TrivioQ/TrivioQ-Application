'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Play, AlertTriangle, Copy, Check, Square, FileJson, Download, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkflowLogs } from './workflow-logs';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IngestionJob {
  id: string;
  processType: string;
  status: string;
  progress: number;
  overallProgress: number;
  currentPhase: string | null;
  fileName: string;
  totalQuestions: number;
  questionsExtracted: number | null;
  questionsUploaded: number | null;
  currentPage: number | null;
  totalPages: number | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  errorLogs: string | null;
  manifestData: Record<string, unknown> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isStale(job: IngestionJob): boolean {
  if (job.status !== 'PROCESSING') return false;
  const ref = job.lastHeartbeatAt ?? job.updatedAt;
  return Date.now() - new Date(ref).getTime() > STALE_THRESHOLD_MS;
}

function statusVariant(status: string): 'destructive' | 'default' | 'secondary' | 'outline' {
  if (status === 'FAILED') return 'destructive';
  if (status === 'COMPLETED') return 'default';
  return 'secondary';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JobDetail({ jobId }: { jobId: string }) {
  const t = useTranslations('system.ingestion');
  const confirm = useConfirm();
  const router = useRouter();

  const [job, setJob] = useState<IngestionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [jobIdCopied, setJobIdCopied] = useState(false);

  // ── Fetch job data ──────────────────────────────────────────────────────────

  const fetchJob = useCallback(
    async (signal?: AbortSignal): Promise<IngestionJob | null> => {
      try {
        const res = await fetch(`/api/v1/admin/ingestion/jobs/${jobId}`, { signal });
        if (!res.ok) throw new Error('Failed to load job');
        const data = await res.json();
        if (!signal?.aborted) {
          setJob(data.data);
          return data.data as IngestionJob;
        }
        return null;
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        if (!signal?.aborted) setError(t('loadError'));
        return null;
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'PAUSED']);
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const freshJob = await fetchJob(controller.signal);
      // Self-terminate once the job reaches a terminal state — no stale state check needed
      if (freshJob && TERMINAL_STATUSES.has(freshJob.status) && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Initial fetch
    void poll();

    // Poll every 5 s; the interval self-clears when a terminal status is received
    intervalId = setInterval(() => void poll(), 5000);

    return () => {
      controller.abort();
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [fetchJob]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const retryJob = async (phaseToForce: string = 'none') => {
    if (!job) return;
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
      fetchJob();
    } else {
      toast.error(t('errorAction'));
    }
  };

  const pauseJob = async () => {
    if (!job) return;
    const ok = await confirm({
      title: t('confirmations.pauseTitle', { fallback: 'Pause Job' }),
      message: t('confirmations.pauseMessage', { fallback: 'Are you sure you want to pause this job?' }),
      confirmLabel: t('confirmations.pauseConfirm', { fallback: 'Pause' }),
      cancelLabel: t('confirmations.cancel'),
      isDestructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/v1/admin/ingestion/jobs/${job.id}/pause`, {
      method: 'POST',
    });

    if (res.ok) {
      toast.success(t('pauseSuccess', { fallback: 'Job paused' }));
      fetchJob();
    } else {
      toast.error(t('errorAction'));
    }
  };
  const deleteJob = async () => {
    if (!job) return;
    const ok = await confirm({
      title: t('confirmations.deleteTitle', { fallback: 'Delete Job' }),
      message: t('confirmations.deleteMessage', { fallback: 'Are you sure you want to delete this job?' }),
      confirmLabel: t('confirmations.deleteConfirm', { fallback: 'Delete' }),
      cancelLabel: t('confirmations.cancel'),
      isDestructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/v1/admin/ingestion/jobs/${job.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toast.success(t('deleteSuccess', { fallback: 'Job deleted' }));
      router.push('/ingestion');
    } else {
      toast.error(t('errorAction'));
    }
  };

  const copyErrorLogs = () => {
    if (!job?.errorLogs) return;
    navigator.clipboard.writeText(job.errorLogs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyJobId = () => {
    if (!job) return;
    navigator.clipboard.writeText(job.id).then(() => {
      setJobIdCopied(true);
      toast.success(t('copiedId', { fallback: 'Job ID copied to clipboard' }));
      setTimeout(() => setJobIdCopied(false), 2000);
    });
  };

  // ── Phase-aware progress description ────────────────────────────────────────

  const phaseDetail = (() => {
    if (!job || job.status !== 'PROCESSING') return null;
    const phase = job.currentPhase;
    const isQuiz = job.processType === 'QUIZ_GENERATION';

    if (phase === 'SCOUT') {
      return job.currentPage !== null && job.totalPages !== null
        ? t('phaseDetail.scouting', { current: job.currentPage, total: job.totalPages })
        : t('phaseDetail.scoutingGeneric');
    }
    if (phase === 'EXTRACTION') {
      const label = isQuiz ? t('phaseDetail.generating') : t('phaseDetail.extracting');
      return job.currentPage !== null && job.totalPages !== null
        ? `${label} — ${t('phaseDetail.page', { current: job.currentPage, total: job.totalPages })}`
        : label;
    }
    if (phase === 'ENHANCEMENT') {
      const extracted = job.questionsExtracted ?? job.totalQuestions;
      return t('phaseDetail.enhancing', { count: extracted });
    }
    if (phase === 'UPLOAD') {
      const uploaded = job.questionsUploaded ?? 0;
      const total = job.questionsExtracted ?? job.totalQuestions;
      return t('phaseDetail.uploading', { uploaded, total });
    }
    return null;
  })();

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>;
  }

  if (error || !job) {
    return <p className="text-sm text-destructive py-6 text-center">{error ?? t('notFound')}</p>;
  }

  const stale = isStale(job);
  const heartbeatRef = job.lastHeartbeatAt ?? job.updatedAt;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div>
              <CardTitle>{job.fileName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <CardDescription className="font-mono">{t('idLabel', { id: job.id })}</CardDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={copyJobId}
                  title={t('copyId', { fallback: 'Copy Job ID' })}
                >
                  {jobIdCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stale && (
                <Badge variant="outline" className="text-amber-500 border-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t('staleWarning')}
                </Badge>
              )}
              {job.status === 'PROCESSING' && !stale ? (
                <Badge className="animate-pulse bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  {job.status}
                </Badge>
              ) : (
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('form.processType')}: </span>
              <span className="font-medium">
                {job.processType === 'QUIZ_GENERATION'
                  ? t('form.quizGeneration')
                  : job.processType === 'QUESTION_EXTRACTION'
                    ? t('form.questionExtraction')
                    : job.processType}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('phase')}: </span>
              <span className="font-medium">{job.currentPhase ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('overallProgress')}: </span>
              <span className="font-medium">{job.overallProgress}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('questionsExtracted')}: </span>
              <span className="font-medium">{job.questionsExtracted ?? job.totalQuestions}</span>
            </div>
            {job.questionsUploaded !== null && (
              <div>
                <span className="text-muted-foreground">{t('questionsUploaded')}: </span>
                <span className="font-medium">{job.questionsUploaded}</span>
              </div>
            )}
            {job.totalPages !== null && (
              <div>
                <span className="text-muted-foreground">{t('totalPages')}: </span>
                <span className="font-medium">{job.totalPages}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t('createdAt')}: </span>
              <span className="font-medium">{format(new Date(job.createdAt), 'PP p')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('lastUpdated')}: </span>
              <span className="font-medium">{formatDistanceToNow(new Date(heartbeatRef), { addSuffix: true })}</span>
            </div>
            {job.processedAt && (
              <div>
                <span className="text-muted-foreground">{t('processedAt')}: </span>
                <span className="font-medium">{format(new Date(job.processedAt), 'PP p')}</span>
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('overallProgress')}</span>
              <span className="font-semibold">{job.overallProgress}%</span>
            </div>
            <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 ease-in-out"
                style={{ width: `${job.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Phase progress bar — only while processing */}
          {job.status === 'PROCESSING' && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {phaseDetail ?? t('progress')}
                </span>
                <span className="font-medium text-muted-foreground">{job.progress}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary/60 h-full transition-all duration-500 ease-in-out"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Live workflow logs (GitLab-style terminal, streamed via SSE) */}
          <WorkflowLogs jobId={job.id} status={job.status} />

          {/* Completed summary */}
          {job.status === 'COMPLETED' && (
            <div className="rounded-md bg-muted/50 p-4 text-sm space-y-1">
              <p className="font-medium text-foreground">{t('completedSummary.title')}</p>
              <p className="text-muted-foreground">
                {t('completedSummary.extracted', { count: job.questionsExtracted ?? job.totalQuestions })}
              </p>
              <p className="text-muted-foreground">
                {t('completedSummary.uploaded', { count: job.questionsUploaded ?? 0 })}
              </p>
            </div>
          )}

          {/* Error panel */}
          {job.errorLogs && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-destructive/20">
                <span className="text-sm font-semibold">{t('errorPanel.title')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={copyErrorLogs}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <pre className="text-xs p-4 whitespace-pre-wrap font-mono overflow-auto max-h-64">
                {job.errorLogs}
              </pre>
            </div>
          )}

          {/* Manifest config */}
          {job.manifestData && (
            <div className="mt-4 p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono overflow-auto max-h-64">
              <strong>{t('manifestConfig')}</strong>
              <pre className="mt-2">{JSON.stringify(job.manifestData, null, 2)}</pre>
            </div>
          )}
        </CardContent>

        {/* Actions footer */}
        <CardFooter className="flex flex-col sm:flex-row items-center gap-4 bg-muted/50 p-4 border-t">
          <div className="flex items-center gap-4 w-full sm:w-auto flex-wrap">
            {/* Retry — only for FAILED / COMPLETED */}
            {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button />}>
                  <Play className="mr-2 h-4 w-4" />
                  {t('confirmations.retryConfirm')}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => retryJob('none')}>
                    {t('phases.none')}
                  </DropdownMenuItem>
                  {job.processType !== 'QUIZ_GENERATION' && (
                    <DropdownMenuItem onClick={() => retryJob('SCOUT')}>
                      {t('phases.scout')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => retryJob('EXTRACTION')}>
                    {t('phases.extraction')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => retryJob('ENHANCEMENT')}>
                    {t('phases.enhancement')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => retryJob('UPLOAD')}>
                    {t('phases.upload')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Pause — only while actively processing */}
            {job.status === 'PROCESSING' && (
              <Button onClick={pauseJob} variant="secondary">
                <Square className="mr-2 h-4 w-4" />
                {t('confirmations.pauseConfirm', { fallback: 'Pause' })}
              </Button>
            )}

            {/* Resume — only when paused */}
            {job.status === 'PAUSED' && (
              <Button onClick={() => retryJob('none')} variant="default">
                <Play className="mr-2 h-4 w-4" />
                {t('confirmations.resumeConfirm', { fallback: 'Resume' })}
              </Button>
            )}

            {/* Artifact actions and delete */}
            <div className="flex items-center gap-2 ml-auto flex-wrap justify-end w-full sm:w-auto">
              {job.status !== 'QUEUED' && (
                <>
                  <Button variant="outline" nativeButton={false} render={<Link href={`/ingestion/${job.id}/artifact`} target="_blank" />}>
                    <FileJson className="mr-2 h-4 w-4" />
                    {t('viewArtifact', { fallback: 'View Artifact' })}
                  </Button>
                  <Button variant="outline" nativeButton={false} render={<a href={`/api/v1/admin/ingestion/jobs/${job.id}/artifact?download=true`} download={`job-${job.id}-state.json`} />}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('downloadArtifact', { fallback: 'Download Artifact' })}
                  </Button>
                </>
              )}
              {job.status !== 'PROCESSING' && (
                <Button variant="destructive" onClick={deleteJob}>
                  <Trash className="mr-2 h-4 w-4" />
                  {t('confirmations.deleteConfirm', { fallback: 'Delete' })}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>

      </Card>
    </div>
  );
}
