'use client';

import { useMutation } from '@tanstack/react-query';
import { makeAPICallV1, APIError } from '../../lib/api';
import { useNotification } from '../../context/NotificationContext';

export default function WebDashboard() {
  const { error: notifyError, warning: notifyWarning, success: notifySuccess } = useNotification();

  // No token needed — the tq_auth cookie is injected by the proxy automatically
  const onDemandMutation = useMutation({
    mutationFn: () => makeAPICallV1('drops/on-demand', { method: 'POST' }),
    onSuccess: () => {
      notifySuccess('Check your mobile app to play!', 'Drop granted 🎉');
    },
    onError: (err: unknown) => {
      if (err instanceof APIError && err.code === 'UPGRADE_REQUIRED') {
        notifyWarning('Want more trivia right now? Upgrade to Premium for up to 100 questions a day.', 'Upgrade Required');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to request a drop.';
        notifyError(msg, 'Request failed');
      }
    },
  });

  const handleRequestNext = () => onDemandMutation.mutate();

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-950 px-6 py-12 lg:px-8 selection:bg-indigo-500 selection:text-white'>
      <div className='w-full max-w-md space-y-8 bg-gray-900 p-10 rounded-2xl border border-white/5 shadow-2xl text-center'>
        <h2 className='mt-6 text-3xl font-bold tracking-tight text-white'>Your Dashboard</h2>
        <p className='text-gray-400 mt-2'>Welcome back. Your stats will appear here.</p>

        <div className='mt-8'>
          <button onClick={handleRequestNext} disabled={onDemandMutation.isPending} className='group relative flex w-full justify-center rounded-md bg-purple-600 px-3 py-4 text-sm font-semibold text-white hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 transition-all shadow-lg'>
            {onDemandMutation.isPending ? 'Requesting...' : 'Request Next Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
