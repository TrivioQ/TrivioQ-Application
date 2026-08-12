import { getTranslations } from 'next-intl/server';
import { IngestionStagesManager } from '@/components/ai-config/ingestion-stages-manager';
import { SlidersHorizontal } from 'lucide-react';

export default async function IngestionSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations('ingestionSettings');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">
          <SlidersHorizontal className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <IngestionStagesManager />
    </div>
  );
}
