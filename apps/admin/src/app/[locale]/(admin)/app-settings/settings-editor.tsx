'use client';

import { useState, useTransition } from 'react';
import { updateSetting } from '@/app/actions/setting-actions';
import { Check, Pencil, X } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Setting = {
  key: string;
  value: string;
  dataType: string;
  label: string | null;
  updatedAt: Date;
  updatedBy: string | null;
};

function SettingRow({ setting }: { setting: Setting }) {
  const t = useTranslations('appSettings');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setting.value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (setting.dataType === 'number' && isNaN(Number(draft))) {
      setError(t('validationError'));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSetting(setting.key, draft);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error ?? t('saveFailed'));
      }
    });
  };

  const handleCancel = () => {
    setDraft(setting.value);
    setError(null);
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-4 px-6">
        <p className="font-medium text-gray-900">{setting.label ?? setting.key}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{setting.key}</p>
      </td>
      <td className="py-4 px-6">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{setting.dataType}</span>
      </td>
      <td className="py-4 px-6">
        {editing ? (
          <div className="flex items-center gap-2">
            <input type={setting.dataType === 'number' ? 'number' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            <button onClick={handleSave} disabled={isPending} className="rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={handleCancel} disabled={isPending} className="rounded-md bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-800">{setting.value}</span>
            <button onClick={() => setEditing(true)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <Pencil size={14} />
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </td>
      <td className="py-4 px-6 text-xs text-gray-400">
        <p>{new Date(setting.updatedAt).toLocaleString()}</p>
        {setting.updatedBy && <p className="mt-0.5">{setting.updatedBy}</p>}
      </td>
    </tr>
  );
}

export default function SettingsEditor({ settings, pageCount = 1, currentPage = 1, search = '' }: { settings: Setting[]; pageCount?: number; currentPage?: number; search?: string }) {
  const t = useTranslations('appSettings');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchValue) {
      params.set('search', searchValue);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center max-w-sm border rounded-md overflow-hidden bg-white px-2 h-10 border-gray-200 shadow-sm">
        <input placeholder={t('searchPlaceholder')} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full border-0 focus:outline-none px-2 text-sm" />
        {searchValue !== search && (
          <button onClick={handleSearch} className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded">
            {t('apply')}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-3 px-6">{t('columns.setting')}</th>
              <th className="py-3 px-6">{t('columns.type')}</th>
              <th className="py-3 px-6">{t('columns.value')}</th>
              <th className="py-3 px-6">{t('columns.lastUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  {t('noSettings')}
                </td>
              </tr>
            ) : (
              settings.map((s) => <SettingRow key={s.key} setting={s} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{t('showingPage', { current: currentPage, total: Math.max(1, pageCount) })}</div>
        <div className="flex items-center space-x-2">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 hover:bg-gray-50">
            {t('prev')}
          </button>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pageCount} className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 hover:bg-gray-50">
            {t('next')}
          </button>
        </div>
      </div>
    </div>
  );
}
