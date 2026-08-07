import { useTranslations } from 'next-intl';
import { IngestionDashboard } from '@/components/ingestion/ingestion-dashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata = {
  title: 'Ingestion - TrivioQ Admin',
};

export default function IngestionPage() {
  const t = useTranslations('system.ingestion');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/app-settings" />}>
            {t('settings')}
          </Button>
          <Button nativeButton={false} render={<Link href="/ingestion/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newJob')}
          </Button>
        </div>
      </div>

      <IngestionDashboard />
    </div>
  );
}
