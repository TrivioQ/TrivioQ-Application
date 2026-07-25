import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SubscriptionSettings } from '@/components/subscription-settings';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('subscriptionTitle'),
    description: t('subscriptionDescription'),
  };
}

export default async function SubscriptionPage() {
  const hasCookie = !!cookies().get('tq_auth');
  if (!hasCookie) redirect('/login');

  const t = await getTranslations('subscription');

  return (
    <div className="min-h-screen text-text selection:bg-brand-500 selection:text-text pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 space-y-10 sm:space-y-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-text">{t('title')}</h1>
          <p className="text-text-muted mt-2">{t('description')}</p>
        </div>

        <SubscriptionSettings />
      </div>
    </div>
  );
}
