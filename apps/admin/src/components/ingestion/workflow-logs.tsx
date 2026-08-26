'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface WorkflowLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  phase: string;
  message: string;
}

interface DividerEntry {
  kind: 'divider';
  message: string;
}

type Line = WorkflowLogEntry | DividerEntry;

const MAX_LINES = 5000;

function isDivider(l: Line): l is DividerEntry {
  return (l as DividerEntry).kind === 'divider';
}

const phaseColors: Record<string, string> = {
  SYSTEM: 'text-sky-400',
  PDF: 'text-violet-400',
  SCOUT: 'text-cyan-400',
  EXTRACTION: 'text-blue-400',
  ENHANCEMENT: 'text-emerald-400',
  UPLOAD: 'text-amber-400',
  COMPLETED: 'text-green-400',
  FAILED: 'text-red-400',
};

function fmtTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function WorkflowLogs({ jobId, status }: { jobId: string; status: string }) {
  const t = useTranslations('system.ingestion.workflowLogs');
  const [lines, setLines] = useState<Line[]>([]);
  const [stick, setStick] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [terminal, setTerminal] = useState<string | null>(
    status === 'COMPLETED' || status === 'FAILED' || status === 'PAUSED' ? status : null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const appendLine = useCallback((entry: Line) => {
    setLines((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const appendDivider = useCallback(
    (message: string) => {
      appendLine({ kind: 'divider', message });
    },
    [appendLine],
  );

  useEffect(() => {
    let reset = false;
    // Reset view state for this job lazily, inside the stream's first event —
    // avoids synchronous setState in the effect body.
    const resetOnce = () => {
      if (reset) return;
      reset = true;
      setLines([]);
      setStick(true);
      setReconnecting(false);
      setTerminal(null);
    };

    const es = new EventSource(`/api/v1/admin/ingestion/jobs/${jobId}/logs`);

    es.onopen = () => {
      resetOnce();
      setReconnecting(false);
    };
    es.onmessage = (e) => {
      resetOnce();
      setReconnecting(false);
      try {
        appendLine(JSON.parse(e.data) as WorkflowLogEntry);
      } catch {
        // ignore malformed line
      }
    };
    es.addEventListener('truncated', () => appendDivider(t('earlierTruncated')));
    es.addEventListener('rotated', () => {
      setLines([]);
      appendDivider(t('logRotated'));
    });
    es.addEventListener('done', (e: MessageEvent) => {
      try {
        setTerminal(JSON.parse(e.data).status);
      } catch {
        setTerminal('ENDED');
      }
      es.close();
      if (stick) {
        scrollToBottom('instant');
      }
    });
    es.onerror = () => {
      setReconnecting(true);
    };

    return () => es.close();
  }, [jobId, appendLine, appendDivider, t, stick, scrollToBottom]);

  // Synchronous DOM layout scroll to bottom whenever stick is true and lines update
  useLayoutEffect(() => {
    if (stick) {
      scrollToBottom('instant');
    }
  }, [lines, stick, scrollToBottom]);

  // Post-render/RAF scroll to guarantee scrolling on load / async layout
  useEffect(() => {
    if (stick) {
      scrollToBottom('instant');
      const raf = requestAnimationFrame(() => {
        if (stick) scrollToBottom('instant');
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [lines, stick, scrollToBottom]);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 32);
  }, []);

  const jumpToBottom = useCallback(() => {
    setStick(true);
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  // Precompute, for each line, whether it should render a phase-separator header.
  // Computed outside the JSX to avoid render-time mutation of a loop variable.
  const showHeader = useMemo(() => {
    const flags = new Array<boolean>(lines.length).fill(false);
    let prev: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (isDivider(l)) {
        prev = null; // dividers reset phase grouping
        continue;
      }
      flags[i] = l.phase !== prev;
      prev = l.phase;
    }
    return flags;
  }, [lines]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{t('title')}</span>
        <span className="text-xs text-muted-foreground">
          {reconnecting
            ? t('reconnecting')
            : terminal
              ? t('streamEnded', { terminal })
              : t('live')}
        </span>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="h-[500px] w-full overflow-y-auto overflow-x-auto rounded-md border border-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100"
        >
          {lines.length === 0 && !reconnecting && (
            <div className="text-zinc-500">{t('waiting')}</div>
          )}
          {lines.map((l, i) => {
            if (isDivider(l)) {
              return (
                <div key={i} className="my-2 text-zinc-500">
                  {l.message}
                </div>
              );
            }
            const showPhaseHeader = showHeader[i];
            const color =
              l.level === 'error'
                ? 'text-red-400 bg-red-950/30'
                : l.level === 'warn'
                  ? 'text-amber-300'
                  : 'text-zinc-100';
            return (
              <div key={i}>
                {showPhaseHeader && (
                  <div className="my-1 border-t border-zinc-800 pt-1 text-zinc-500">
                    ── {l.phase} ──
                  </div>
                )}
                <div className={`flex gap-2 rounded ${color}`}>
                  <span className="shrink-0 text-zinc-500">{fmtTs(l.ts)}</span>
                  <span className={`shrink-0 font-semibold ${phaseColors[l.phase] ?? 'text-zinc-400'}`}>
                    {l.phase}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{l.message}</span>
                </div>
              </div>
            );
          })}
        </div>
        {!stick && (
          <Button
            size="sm"
            variant="outline"
            onClick={jumpToBottom}
            className="absolute bottom-2 right-2 h-8 gap-1 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50 border-zinc-800"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {t('jumpToBottom')}
          </Button>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {lines.length >= MAX_LINES
          ? t('showingMaxLines', { max: MAX_LINES })
          : t('linesCount', { count: lines.length })}
      </div>
    </div>
  );
}

