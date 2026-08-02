'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface IngestionJob {
  id: string;
  processType: string;
  status: string;
  progress: number;
  currentPhase: string | null;
  fileName: string;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
  errorLogs: string | null;
  manifestData: any;
}

export function JobDetail({ jobId }: { jobId: string }) {
  const t = useTranslations('system.ingestion');
  const confirm = useConfirm();
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forcePhase, setForcePhase] = useState<string>('none');

  const fetchJob = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/v1/admin/ingestion/jobs/${jobId}`, { signal });
      if (!res.ok) throw new Error('Failed to load job');
      const data = await res.json();
      
      if (!signal?.aborted) {
        setJob(data.data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (!signal?.aborted) setError(t('loadError'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [jobId, t]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJob(controller.signal);

    const intervalId = setInterval(() => {
      fetchJob();
    }, 5000); // refresh every 5s

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchJob]);

  const retryJob = async () => {
    if (!job) return;
    const ok = await confirm({
      title: t('confirmations.retryTitle'),
      message: t('confirmations.retryMessage'),
      confirmLabel: t('confirmations.retryConfirm'),
      cancelLabel: t('confirmations.cancel'),
    });
    if (!ok) return;

    const payload: any = {};
    if (forcePhase !== 'none') {
      payload.forcePhase = forcePhase;
    }

    const res = await fetch(`/api/v1/admin/ingestion/jobs/${job.id}/retry`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      toast.success('Job queued for retry');
      fetchJob();
    } else {
      toast.error(t('errorAction'));
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>;
  }

  if (error || !job) {
    return <p className="text-sm text-destructive py-6 text-center">{error || 'Job not found'}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{job.fileName}</CardTitle>
              <CardDescription>ID: {job.id}</CardDescription>
            </div>
            <Badge variant={job.status === 'FAILED' ? 'destructive' : job.status === 'COMPLETED' ? 'default' : 'secondary'}>
              {job.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Process Type: </span>
              <span className="font-medium">{job.processType === 'QUIZ_GENERATION' ? t('form.quizGeneration') : job.processType === 'QUESTION_EXTRACTION' ? t('form.questionExtraction') : job.processType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Phase: </span>
              <span className="font-medium">{job.currentPhase || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Progress: </span>
              <span className="font-medium">{job.progress}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Questions Extracted: </span>
              <span className="font-medium">{job.totalQuestions}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created At: </span>
              <span className="font-medium">{format(new Date(job.createdAt), 'PP p')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated At: </span>
              <span className="font-medium">{format(new Date(job.updatedAt), 'PP p')}</span>
            </div>
          </div>

          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500 ease-in-out" 
              style={{ width: `${job.progress}%` }} 
            />
          </div>

          {job.errorLogs && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-md text-sm whitespace-pre-wrap font-mono overflow-auto max-h-64">
              {job.errorLogs}
            </div>
          )}

          {job.manifestData && (
            <div className="mt-4 p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono overflow-auto max-h-64">
              <strong>Manifest Config:</strong>
              <pre className="mt-2">{JSON.stringify(job.manifestData, null, 2)}</pre>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center gap-4 bg-muted/50 p-4 border-t">
          {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Label>Restart From:</Label>
                <Select value={forcePhase} onValueChange={(val) => val && setForcePhase(val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Reset (Resume)</SelectItem>
                    <SelectItem value="SCOUT">Scout Phase</SelectItem>
                    <SelectItem value="EXTRACTION">Extraction Phase</SelectItem>
                    <SelectItem value="ENHANCEMENT">Enhancement Phase</SelectItem>
                    <SelectItem value="UPLOAD">Upload Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={retryJob}>
                <Play className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
