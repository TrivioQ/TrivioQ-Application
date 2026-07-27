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
    <tr className="border-b border-border last:border-0">
      <td className="py-4 px-4 sm:py-4 sm:px-6">
        <p className="font-medium text-foreground">{setting.label ?? setting.key}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{setting.key}</p>
      </td>
      <td className="py-4 px-4 sm:py-4 sm:px-6">
        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground whitespace-nowrap">{setting.dataType}</span>
      </td>
      <td className="py-4 px-4 sm:py-4 sm:px-6">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type={setting.dataType === 'number' ? 'number' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full sm:w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
            <button onClick={handleSave} disabled={isPending} className="rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={handleCancel} disabled={isPending} className="rounded-md bg-muted p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-foreground break-all">{setting.value}</span>
            <button onClick={() => setEditing(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Pencil size={14} />
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </td>
      <td className="hidden md:table-cell py-4 px-4 sm:py-4 sm:px-6 text-xs text-muted-foreground">
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
      <div className="flex items-center max-w-sm border rounded-md overflow-hidden bg-background px-2 h-10 border-border shadow-sm">
        <input placeholder={t('searchPlaceholder')} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full border-0 focus:outline-none px-2 text-sm bg-transparent text-foreground" />
        {searchValue !== search && (
          <button onClick={handleSearch} className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded">
            {t('apply')}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm text-card-foreground">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-3 px-4 sm:px-6">{t('columns.setting')}</th>
              <th className="py-3 px-4 sm:px-6">{t('columns.type')}</th>
              <th className="py-3 px-4 sm:px-6">{t('columns.value')}</th>
              <th className="hidden md:table-cell py-3 px-4 sm:px-6">{t('columns.lastUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('noSettings')}
                </td>
              </tr>
            ) : (
              settings.map((s) => <SettingRow key={s.key} setting={s} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{t('showingPage', { current: currentPage, total: Math.max(1, pageCount) })}</div>
        <div className="flex items-center space-x-2">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1 border border-border rounded text-sm text-foreground disabled:opacity-50 hover:bg-accent hover:text-accent-foreground">
            {t('prev')}
          </button>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pageCount} className="px-3 py-1 border border-border rounded text-sm text-foreground disabled:opacity-50 hover:bg-accent hover:text-accent-foreground">
            {t('next')}
          </button>
        </div>
      </div>
    </div>
  );
}
