'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useNotification } from '@/context/notification-context';
import { makeAPICallV1 } from '@/lib/api';
import { useAuth } from '@/context/auth-provider';
import { useConfirm } from '@/components/confirm-modal';

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
    <div className="space-y-10 sm:space-y-12">
      {/* ── Display Name (Identity) ── */}
      <section className="bg-bg-secondary/70 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none rounded-2xl border border-brand-100 dark:border-white/5 p-4 sm:p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-text">{t('displayNameTitle')}</h3>
          <p className="text-sm text-text-muted">{t('displayNameDesc')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('displayNameLabel')}</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder={t('displayNamePlaceholder')} />
        </div>

        {initialUser.dateOfBirth && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('dateOfBirthLabel')}</label>
            <div className="w-full bg-bg dark:bg-overlay/60 border border-border dark:border-white/5 rounded-xl px-4 py-3 text-text-muted text-sm select-none cursor-not-allowed">{initialUser.dateOfBirth}</div>
            <p className="text-xs text-text-muted">{t('dateOfBirthReadOnly')}</p>
          </div>
        )}

        <button onClick={handleUpdatePreferences} disabled={isPending} className="bg-brand-600 hover:bg-brand-500 text-text px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
          {isPending ? t('saving') : t('updateName')}
        </button>
      </section>

      {/* ── Active Time (Most Used) ── */}
      <section className="bg-bg-secondary/70 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none rounded-2xl border border-brand-100 dark:border-white/5 p-4 sm:p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-text">{t('activeTimeTitle')}</h3>
          <p className="text-sm text-text-muted">{t('activeTimeDesc')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('startTimeLabel')}</label>
            <input type="time" value={activeStart} onChange={(e) => setActiveStart(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('endTimeLabel')}</label>
            <input type="time" value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <button onClick={handleUpdatePreferences} disabled={isPending} className="bg-brand-600 hover:bg-brand-500 text-text px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
          {isPending ? t('saving') : t('saveTimeSettings')}
        </button>
      </section>

      {/* ── Difficulty Preferences ── TEMPORARILY HIDDEN: fixed defaults used for all users (Easy:20%, Medium:70%, Hard:10%) */}

      {/* ── Security / Change Password (if email) ── */}
      {isEmailUser && (
        <section className="bg-bg-secondary/70 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none rounded-2xl border border-brand-100 dark:border-white/5 p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-text">{t('changePasswordTitle')}</h3>
            <p className="text-sm text-text-muted">{t('changePasswordDesc')}</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted">{t('currentPasswordLabel')}</label>
              <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted">{t('newPasswordLabel')}</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted">{t('confirmPasswordLabel')}</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button type="submit" disabled={isPending} className="bg-text-muted/20 hover:bg-text-muted/30 dark:bg-overlay dark:hover:bg-text-muted/20 text-text px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              {t('updatePassword')}
            </button>
          </form>
        </section>
      )}

      {/* ── Danger Zone ── */}
      <section className="bg-error/5 rounded-2xl border border-error/10 p-4 sm:p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-error">{t('dangerZoneTitle')}</h3>
          <p className="text-sm text-error/70">{t('dangerZoneDesc')}</p>
        </div>

        <button onClick={handleDeleteAccount} disabled={isPending} className="bg-error/10 hover:bg-error/20 text-error border border-error/20 px-6 py-2.5 rounded-xl text-sm font-bold transition-all">
          {t('deleteAccount')}
        </button>
      </section>
    </div>
  );
}
