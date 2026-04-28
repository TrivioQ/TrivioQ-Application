import { getSettings } from '@/app/actions/setting-actions';
import SettingsEditor from './settings-editor';

export default async function AppSettingsPage() {
  const result = await getSettings();
  const data = result.success && result.data ? result.data : [];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight text-gray-900'>App Settings</h1>
        <p className='text-gray-500 mt-2'>Manage application-wide configuration. Changes take effect within 60 seconds.</p>
      </div>

      {result.error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-600'>{result.error}</div>}

      <SettingsEditor settings={data} />
    </div>
  );
}
