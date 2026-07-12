'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useNotification } from '@/context/notification-context';
import { makeAPICallV1 } from '@/lib/api';
import { useAuth } from '@/context/auth-provider';
import { useConfirm } from '@/components/confirm-modal';

// interface Preferences {
//   difficultyPercentages: Record<string, number>;
// }

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
  const [isPending, setIsPending] = useState(false);
  const confirm = useConfirm();

  // TEMPORARILY HIDDEN: difficulty selection is locked to fixed defaults for all users
  const DEFAULT_DIFFICULTY = { EASY: 20, MEDIUM: 70, HARD: 10 };
  // const initialPrefs: Preferences = initialUser.preferences || {
  //   difficultyPercentages: DEFAULT_DIFFICULTY,
  // };

  const [displayName, setDisplayName] = useState(initialUser.displayName || '');
  // Active window is authoritative in the User DB columns, not the preferences JSON blob
  const [activeStart, setActiveStart] = useState(isoToHHMM(initialUser.activeWindowStart));
  const [activeEnd, setActiveEnd] = useState(isoToHHMM(initialUser.activeWindowEnd));
  // TEMPORARILY HIDDEN: always use the fixed default difficulty, ignoring any saved user preference
  const [difficulty] = useState(DEFAULT_DIFFICULTY);

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
    <div className="space-y-12">
      {/* ── Display Name (Identity) ── */}
      <section className="bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('displayNameTitle')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('displayNameDesc')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('nameLabel')}</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('displayNamePlaceholder')} />
        </div>

        {initialUser.dateOfBirth && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('dateOfBirthLabel')}</label>
            <div className="w-full bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-gray-500 dark:text-gray-400 text-sm select-none cursor-not-allowed">{initialUser.dateOfBirth}</div>
            <p className="text-xs text-gray-600">{t('dateOfBirthReadOnly')}</p>
          </div>
        )}

        <button onClick={handleUpdatePreferences} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
          {isPending ? t('saving') : t('updateName')}
        </button>
      </section>

      {/* ── Active Time (Most Used) ── */}
      <section className="bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('activeTimeTitle')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('activeTimeDesc')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('startTimeLabel')}</label>
            <input type="time" value={activeStart} onChange={(e) => setActiveStart(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('endTimeLabel')}</label>
            <input type="time" value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <button onClick={handleUpdatePreferences} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
          {isPending ? t('saving') : t('saveTimeSettings')}
        </button>
      </section>

      {/* ── Difficulty Preferences ── TEMPORARILY HIDDEN: fixed defaults used for all users (Easy:20%, Medium:70%, Hard:10%) */}

      {/* ── Security / Change Password (if email) ── */}
      {isEmailUser && (
        <section className="bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('changePasswordTitle')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('changePasswordDesc')}</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">{t('currentPasswordLabel')}</label>
              <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">{t('newPasswordLabel')}</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">{t('confirmPasswordLabel')}</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={isPending} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              {t('updatePassword')}
            </button>
          </form>
        </section>
      )}

      {/* ── Danger Zone ── */}
      <section className="bg-red-500/5 rounded-2xl border border-red-500/10 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400">{t('dangerZoneTitle')}</h3>
          <p className="text-sm text-gray-500 text-red-600/70 dark:text-red-400/60">{t('dangerZoneDesc')}</p>
        </div>

        <button onClick={handleDeleteAccount} disabled={isPending} className="bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 px-6 py-2.5 rounded-xl text-sm font-bold transition-all">
          {t('deleteAccount')}
        </button>
      </section>
    </div>
  );
}
