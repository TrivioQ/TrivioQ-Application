'use client';

import { useState, useTransition } from 'react';
import { updateSetting } from '@/app/actions/setting-actions';
import { Check, Pencil, X } from 'lucide-react';

type Setting = {
  key: string;
  value: string;
  dataType: string;
  label: string | null;
  updatedAt: Date;
  updatedBy: string | null;
};

function SettingRow({ setting }: { setting: Setting }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setting.value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (setting.dataType === 'number' && isNaN(Number(draft))) {
      setError('Value must be a number');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSetting(setting.key, draft);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error ?? 'Failed to save');
      }
    });
  };

  const handleCancel = () => {
    setDraft(setting.value);
    setError(null);
    setEditing(false);
  };

  return (
    <tr className='border-b border-gray-100 last:border-0'>
      <td className='py-4 px-6'>
        <p className='font-medium text-gray-900'>{setting.label ?? setting.key}</p>
        <p className='text-xs text-gray-400 mt-0.5 font-mono'>{setting.key}</p>
      </td>
      <td className='py-4 px-6'>
        <span className='inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600'>{setting.dataType}</span>
      </td>
      <td className='py-4 px-6'>
        {editing ? (
          <div className='flex items-center gap-2'>
            <input
              type={setting.dataType === 'number' ? 'number' : 'text'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className='w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              autoFocus
            />
            <button onClick={handleSave} disabled={isPending} className='rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50'>
              <Check size={14} />
            </button>
            <button onClick={handleCancel} disabled={isPending} className='rounded-md bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300'>
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className='flex items-center gap-3'>
            <span className='font-mono text-sm text-gray-800'>{setting.value}</span>
            <button onClick={() => setEditing(true)} className='rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700'>
              <Pencil size={14} />
            </button>
          </div>
        )}
        {error && <p className='mt-1 text-xs text-red-500'>{error}</p>}
      </td>
      <td className='py-4 px-6 text-xs text-gray-400'>
        <p>{new Date(setting.updatedAt).toLocaleString()}</p>
        {setting.updatedBy && <p className='mt-0.5'>{setting.updatedBy}</p>}
      </td>
    </tr>
  );
}

export default function SettingsEditor({ settings }: { settings: Setting[] }) {
  if (settings.length === 0) {
    return <p className='text-gray-500 py-8 text-center'>No settings found. Run the seed script to populate defaults.</p>;
  }

  return (
    <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500'>
            <th className='py-3 px-6'>Setting</th>
            <th className='py-3 px-6'>Type</th>
            <th className='py-3 px-6'>Value</th>
            <th className='py-3 px-6'>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((s) => (
            <SettingRow key={s.key} setting={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
