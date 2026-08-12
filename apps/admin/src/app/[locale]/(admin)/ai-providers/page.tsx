import { getTranslations } from 'next-intl/server';
import { AiProvidersManager } from '@/components/ai-config/ai-providers-manager';
import { Cpu } from 'lucide-react';

export default async function AiProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations('aiProviders');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
          <Cpu className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <AiProvidersManager />
    </div>
  );
}
