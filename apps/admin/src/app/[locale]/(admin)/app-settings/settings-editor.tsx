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
            {setting.key.endsWith('_provider') ? (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full sm:w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="google">{t('providers.google')}</option>
                <option value="nvidia">{t('providers.nvidia')}</option>
                <option value="deepseek">{t('providers.deepseek')}</option>
                <option value="local">{t('providers.local')}</option>
              </select>
            ) : (
              <input type={setting.dataType === 'number' ? 'number' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full sm:w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
            )}
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

function SettingsTable({ settings }: { settings: Setting[] }) {
  const t = useTranslations('appSettings');
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm text-card-foreground mb-6">
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
  );
}

export default function SettingsEditor({ settings, search = '' }: { settings: Setting[]; search?: string }) {
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
    params.delete('page'); // Ensure page is removed if it was present
    router.push(`${pathname}?${params.toString()}`);
  };

  // Group settings
  const generalSettings = settings.filter(s => !s.key.startsWith('ingestion_'));
  const ingestionSettings = settings.filter(s => s.key.startsWith('ingestion_'));
  
  // Extract unique phases from ingestion settings (e.g. 'scout', 'extraction')
  const ingestionPhases = Array.from(new Set(
    ingestionSettings
      .map(s => s.key.split('_')[1])
      .filter(Boolean)
  ));

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

      {/* Group: General Settings */}
      {generalSettings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">{t('categories.general') || 'General Settings'}</h2>
          <SettingsTable settings={generalSettings} />
        </div>
      )}

      {/* Group: Ingestion Settings */}
      {ingestionSettings.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-6 text-foreground">{t('categories.ingestion') || 'Ingestion Settings'}</h2>
          
          {ingestionPhases.map(phase => {
            const phaseSettings = ingestionSettings.filter(s => s.key.startsWith(`ingestion_${phase}_`));
            if (phaseSettings.length === 0) return null;
            
            // Try to translate the phase name, fallback to capitalized string
            const phaseKey = `phases.${phase}` as any;
            const phaseName = t(phaseKey) !== `phases.${phase}` 
              ? t(phaseKey) 
              : phase.charAt(0).toUpperCase() + phase.slice(1) + ' Phase';

            return (
              <div key={phase} className="ml-0 sm:ml-6 mb-8">
                <h3 className="text-lg font-medium mb-3 text-foreground border-b pb-2">{phaseName}</h3>
                <SettingsTable settings={phaseSettings} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="text-sm text-muted-foreground">
          {t('showingPage', { current: 1, total: 1 }).replace('page 1 of 1', `${settings.length} settings`)}
        </div>
      </div>
    </div>
  );
}
