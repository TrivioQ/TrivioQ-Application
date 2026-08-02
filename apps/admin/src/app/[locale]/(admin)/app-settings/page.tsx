import { getSettings } from '@/app/actions/setting-actions';
import SettingsEditor from './settings-editor';
import { getTranslations } from 'next-intl/server';

export default async function AppSettingsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const t = await getTranslations('appSettings');
  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'key';
  const sortOrder = typeof params.sortOrder === 'string' ? (params.sortOrder as 'asc' | 'desc') : 'asc';

  const result = await getSettings({ page: 1, pageSize: 1000, search, sortBy, sortOrder });
  const data = result.success && result.data ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {result.error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{result.error}</div>}

      <SettingsEditor settings={data} search={search} />
    </div>
  );
}
