import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function ForbiddenPage() {
  const t = await getTranslations('errors.forbidden');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center bg-white p-10 rounded-2xl shadow-sm border border-gray-100 max-w-md">
        <h1 className="text-5xl font-extrabold text-red-500 mb-4">{t('code')}</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-gray-500 mb-6 text-sm">{t('message')}</p>
        <Link href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gray-900 text-white shadow hover:bg-gray-900/90 h-9 px-4 py-2">
          {t('returnHome')}
        </Link>
      </div>
    </div>
  );
}
