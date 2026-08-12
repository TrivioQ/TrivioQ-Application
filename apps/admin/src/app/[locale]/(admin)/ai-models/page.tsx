import { getTranslations } from 'next-intl/server';
import { AiModelsManager } from '@/components/ai-config/ai-models-manager';
import { Boxes } from 'lucide-react';

export default async function AiModelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations('aiModels');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
          <Boxes className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <AiModelsManager />
    </div>
  );
}
