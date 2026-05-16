'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useNotification } from '@/context/notification-context';
import { makeAPICallV1 } from '@/lib/api';
import { useAuth } from '@/context/auth-provider';
import { useConfirm } from '@/components/confirm-modal';

interface Preferences {
  difficultyPercentages: Record<string, number>;
}

// Convert a UTC DateTime ISO string from the DB column to a "HH:MM" string for <input type="time">
function isoToHHMM(iso: string | undefined | null): string {
  if (!iso) return '09:00';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function SettingsForm({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotification();
  const t = useTranslations('settings');
  const locale = useLocale();
  const [isPending, setIsPending] = useState(false);
  const confirm = useConfirm();

  const initialPrefs: Preferences = initialUser.preferences || {
    difficultyPercentages: { EASY: 40, MEDIUM: 40, HARD: 20 },
  };

  const [displayName, setDisplayName] = useState(initialUser.displayName || '');
  // Active window is authoritative in the User DB columns, not the preferences JSON blob
  const [activeStart, setActiveStart] = useState(isoToHHMM(initialUser.activeWindowStart));
  const [activeEnd, setActiveEnd] = useState(isoToHHMM(initialUser.activeWindowEnd));
  const [difficulty, setDifficulty] = useState(initialPrefs.difficultyPercentages);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isEmailUser = user?.providers?.includes('password');

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();

    const total = Object.values(difficulty).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.1) {
      return notifyError(t('validationError'), t('validationErrorTitle'));
    }

    setIsPending(true);
    try {
      await makeAPICallV1('users/preferences', {
        method: 'PUT',
        body: {
          displayName,
          activeWindowStart: activeStart,
          activeWindowEnd: activeEnd,
          difficultyPercentages: difficulty,
          // Mandatory fields for the existing API schema
          theme: 'dark',
          notificationsEnabled: true,
          language: 'en',
          categoryPercentages: { General: 1.0 },
        },
      });
      notifySuccess(t('preferencesSaved'), t('preferencesSavedTitle'));
      router.refresh();
    } catch (err: any) {
      notifyError(err.message || t('preferencesFailed'));
    } finally {
      setIsPending(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      return notifyError(t('passwordsDontMatch'));
    }

    setIsPending(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t('passwordUpdateFailed'));

      notifySuccess(t('passwordUpdated'), t('passwordUpdatedTitle'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      notifyError(err.message || t('passwordUpdateFailed'));
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: t('deleteModalTitle'),
      message: t('deleteModalMessage'),
      confirmLabel: t('deleteConfirmLabel'),
      cancelLabel: t('deleteCancelLabel'),
      isDestructive: true,
    });
    if (!ok) return;
    setIsPending(true);
    try {
      // 1. Delete from backend
      await makeAPICallV1('auth', { method: 'DELETE' });

      // 2. Local cleanup is handled by redirecting or signing out
      notifyInfo(t('accountDeleted'), t('accountDeletedTitle'));
      window.location.href = '/';
    } catch (err: any) {
      notifyError(err.message || t('deleteAccountFailed'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className='space-y-12'>
      {/* ── Display Name (Identity) ── */}
      <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-white'>{t('displayNameTitle')}</h3>
          <p className='text-sm text-gray-400'>{t('displayNameDesc')}</p>
        </div>

        <div className='space-y-2'>
          <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>{t('nameLabel')}</label>
          <input type='text' value={displayName} onChange={(e) => setDisplayName(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500' placeholder={t('displayNamePlaceholder')} />
        </div>

        {initialUser.dateOfBirth && (
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>{t('dateOfBirthLabel')}</label>
            <div className='w-full bg-gray-800/60 border border-white/5 rounded-xl px-4 py-3 text-gray-400 text-sm select-none cursor-not-allowed'>{new Date(initialUser.dateOfBirth).toLocaleDateString(locale)}</div>
            <p className='text-xs text-gray-600'>{t('dateOfBirthReadOnly')}</p>
          </div>
        )}

        <button onClick={handleUpdatePreferences} disabled={isPending} className='bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
          {isPending ? t('saving') : t('updateName')}
        </button>
      </section>

      {/* ── Active Time (Most Used) ── */}
      <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-white'>{t('activeTimeTitle')}</h3>
          <p className='text-sm text-gray-400'>{t('activeTimeDesc')}</p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>{t('startTimeLabel')}</label>
            <input type='time' value={activeStart} onChange={(e) => setActiveStart(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500' />
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>{t('endTimeLabel')}</label>
            <input type='time' value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500' />
          </div>
        </div>

        <button onClick={handleUpdatePreferences} disabled={isPending} className='bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
          {isPending ? t('saving') : t('saveTimeSettings')}
        </button>
      </section>

      {/* ── Difficulty Preferences ── */}
      <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-white'>{t('difficultyTitle')}</h3>
          <p className='text-sm text-gray-400'>{t('difficultyDesc')}</p>
        </div>

        <div className='space-y-4'>
          {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
            <div key={level} className='flex items-center gap-4'>
              <label className='w-20 text-sm font-bold text-gray-400'>{t(`difficultyLabels.${level}`)}</label>
              <input type='range' min='0' max='100' step='5' value={difficulty[level] || 0} onChange={(e) => setDifficulty({ ...difficulty, [level]: parseInt(e.target.value) })} className='flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500' />
              <span className='w-12 text-right text-sm font-mono font-bold text-white'>{difficulty[level] || 0}%</span>
            </div>
          ))}
          <div className='pt-2 flex justify-between items-center'>
            <p className={`text-xs font-bold ${Math.abs(Object.values(difficulty).reduce((a, b) => a + b, 0) - 100) < 0.1 ? 'text-green-400' : 'text-red-400'}`}>{t('total', { pct: Object.values(difficulty).reduce((a, b) => a + b, 0) })}</p>
            <button onClick={handleUpdatePreferences} disabled={isPending} className='bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
              {t('saveDifficulty')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Security / Change Password (if email) ── */}
      {isEmailUser && (
        <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
          <div>
            <h3 className='text-lg font-bold text-white'>{t('changePasswordTitle')}</h3>
            <p className='text-sm text-gray-400'>{t('changePasswordDesc')}</p>
          </div>

          <form onSubmit={handleChangePassword} className='space-y-4 max-w-sm'>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>{t('currentPasswordLabel')}</label>
              <input type='password' required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>{t('newPasswordLabel')}</label>
              <input type='password' required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>{t('confirmPasswordLabel')}</label>
              <input type='password' required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <button type='submit' disabled={isPending} className='bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
              {t('updatePassword')}
            </button>
          </form>
        </section>
      )}

      {/* ── Danger Zone ── */}
      <section className='bg-red-500/5 rounded-2xl border border-red-500/10 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-red-400'>{t('dangerZoneTitle')}</h3>
          <p className='text-sm text-gray-500 text-red-400/60'>{t('dangerZoneDesc')}</p>
        </div>

        <button onClick={handleDeleteAccount} disabled={isPending} className='bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-6 py-2.5 rounded-xl text-sm font-bold transition-all'>
          {t('deleteAccount')}
        </button>
      </section>
    </div>
  );
}
