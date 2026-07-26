import { Suspense } from 'react';
import { SubscriptionHistoryExplorer } from '@/components/subscription-history/subscription-history-explorer';
import { getTranslations } from 'next-intl/server';

export default async function SubscriptionHistoryPage() {
  const t = await getTranslations('subscriptionHistory');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>
      <Suspense>
        <SubscriptionHistoryExplorer />
      </Suspense>
    </div>
  );
}
