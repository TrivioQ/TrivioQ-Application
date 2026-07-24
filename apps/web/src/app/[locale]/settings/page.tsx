import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { SettingsForm } from './settings-form';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('settingsTitle'),
    description: t('settingsDescription'),
  };
}

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const hasCookie = !!cookies().get('tq_auth');

  if (!hasCookie) {
    redirect('/login');
  }

  let user = null;
  try {
    user = await makeServerAPICallV1<any>('users/me');
  } catch (err) {
    console.error('[SettingsPage] Failed to fetch user:', err);
    // If we can't even fetch the user, something is wrong with auth
    redirect('/login');
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-white selection:bg-teal-500 selection:text-white pb-20">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        {/* ── Header ── */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('subtitle')}</p>
        </div>

        <SettingsForm initialUser={user} />
      </div>
    </div>
  );
}
