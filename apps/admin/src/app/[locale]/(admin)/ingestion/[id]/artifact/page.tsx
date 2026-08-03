'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

// Import JsonView dynamically to avoid SSR issues
const JsonView = dynamic(() => import('react18-json-view'), { ssr: false });
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';

export default function ArtifactViewPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('system.ingestion');

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchArtifact = async () => {
      try {
        const res = await fetch(`/api/v1/admin/ingestion/jobs/${id}/artifact`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(t('artifactNotFound', { fallback: 'Artifact not found for this job. It may not have started yet.' }));
          }
          throw new Error('Failed to load artifact');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchArtifact();
  }, [id, t]);

  return (
    <div className="container mx-auto py-8">
      <Card className="h-[calc(100vh-4rem)] flex flex-col">
        <CardHeader className="flex-none">
          <CardTitle className="text-xl">
            {t('artifactViewer', { fallback: 'Artifact Viewer' })} <span className="text-muted-foreground text-sm font-mono ml-2">({id})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl border-t">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{t('loadingArtifact', { fallback: 'Loading artifact payload...' })}</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-destructive">
              <AlertCircle className="h-8 w-8" />
              <p className="text-center max-w-md">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="p-4 rounded-md text-sm">
              <JsonView
                src={data}
                theme="a11y"
                collapsed={1} // Collapse nodes deeper than 1 level by default
                enableClipboard={true}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
