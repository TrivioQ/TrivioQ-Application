'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '../../context/NotificationContext';
import { makeAPICallV1 } from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';

interface Preferences {
  difficultyPercentages: Record<string, number>;
  activeWindowStart: string;
  activeWindowEnd: string;
}

export function SettingsForm({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotification();
  const [isPending, setIsPending] = useState(false);

  const initialPrefs: Preferences = initialUser.preferences || {
    difficultyPercentages: { EASY: 40, MEDIUM: 40, HARD: 20 },
    activeWindowStart: '09:00',
    activeWindowEnd: '17:00',
  };

  const [activeStart, setActiveStart] = useState(initialPrefs.activeWindowStart);
  const [activeEnd, setActiveEnd] = useState(initialPrefs.activeWindowEnd);
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
      return notifyError('Difficulty percentages must add up to 100%', 'Validation Error');
    }

    setIsPending(true);
    try {
      await makeAPICallV1('users/preferences', {
        method: 'PUT',
        body: {
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
      notifySuccess('Preferences updated successfully', 'Settings Saved');
      router.refresh();
    } catch (err: any) {
      notifyError(err.message || 'Failed to update preferences', 'Error');
    } finally {
      setIsPending(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      return notifyError('New passwords do not match', 'Error');
    }

    setIsPending(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');

      notifySuccess('Password updated successfully', 'Security');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      notifyError(err.message || 'Failed to update password', 'Error');
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you absolutely sure? This will permanently delete your account, score history, and streak. This cannot be undone.')) return;

    setIsPending(true);
    try {
      // 1. Delete from backend
      await makeAPICallV1('auth', { method: 'DELETE' });

      // 2. Local cleanup is handled by redirecting or signing out
      notifyInfo('Account deleted. Redirecting...', 'Goodbye');
      window.location.href = '/';
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete account', 'Error');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className='space-y-12'>
      {/* ── Active Time (Most Used) ── */}
      <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-white'>Active Time</h3>
          <p className='text-sm text-gray-400'>Questions will only be dropped during this window in your local time.</p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>Start Time</label>
            <input type='time' value={activeStart} onChange={(e) => setActiveStart(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500' />
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-gray-500'>End Time</label>
            <input type='time' value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500' />
          </div>
        </div>

        <button onClick={handleUpdatePreferences} disabled={isPending} className='bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
          {isPending ? 'Saving...' : 'Save Time Settings'}
        </button>
      </section>

      {/* ── Difficulty Preferences ── */}
      <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-white'>Question Difficulty</h3>
          <p className='text-sm text-gray-400'>Specify the percentage of questions you want for each difficulty level. Must add up to 100%.</p>
        </div>

        <div className='space-y-4'>
          {['EASY', 'MEDIUM', 'HARD'].map((level) => (
            <div key={level} className='flex items-center gap-4'>
              <label className='w-20 text-sm font-bold text-gray-400'>{level}</label>
              <input type='range' min='0' max='100' step='5' value={difficulty[level] || 0} onChange={(e) => setDifficulty({ ...difficulty, [level]: parseInt(e.target.value) })} className='flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500' />
              <span className='w-12 text-right text-sm font-mono font-bold text-white'>{difficulty[level] || 0}%</span>
            </div>
          ))}
          <div className='pt-2 flex justify-between items-center'>
            <p className={`text-xs font-bold ${Math.abs(Object.values(difficulty).reduce((a, b) => a + b, 0) - 100) < 0.1 ? 'text-green-400' : 'text-red-400'}`}>Total: {Object.values(difficulty).reduce((a, b) => a + b, 0)}%</p>
            <button onClick={handleUpdatePreferences} disabled={isPending} className='bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
              Save Difficulty
            </button>
          </div>
        </div>
      </section>

      {/* ── Security / Change Password (if email) ── */}
      {isEmailUser && (
        <section className='bg-gray-900/50 rounded-2xl border border-white/5 p-6 space-y-6'>
          <div>
            <h3 className='text-lg font-bold text-white'>Change Password</h3>
            <p className='text-sm text-gray-400'>Update your account security.</p>
          </div>

          <form onSubmit={handleChangePassword} className='space-y-4 max-w-sm'>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>Current Password</label>
              <input type='password' required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>New Password</label>
              <input type='password' required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-bold text-gray-500'>Confirm New Password</label>
              <input type='password' required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className='w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-indigo-500' />
            </div>
            <button type='submit' disabled={isPending} className='bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50'>
              Update Password
            </button>
          </form>
        </section>
      )}

      {/* ── Danger Zone ── */}
      <section className='bg-red-500/5 rounded-2xl border border-red-500/10 p-6 space-y-6'>
        <div>
          <h3 className='text-lg font-bold text-red-400'>Danger Zone</h3>
          <p className='text-sm text-gray-500 text-red-400/60'>Once you delete your account, there is no going back. Please be certain.</p>
        </div>

        <button onClick={handleDeleteAccount} disabled={isPending} className='bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-6 py-2.5 rounded-xl text-sm font-bold transition-all'>
          Delete My Account
        </button>
      </section>
    </div>
  );
}
