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
    <div className="min-h-screen text-gray-900 dark:text-white selection:bg-brand-500 selection:text-white pb-20">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('description')}</p>
        </div>

        <SubscriptionSettings />
      </div>
    </div>
  );
}
