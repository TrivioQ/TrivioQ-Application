'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { makeAPICallV1, APIError } from '../../lib/api';

export default function WebDashboard() {
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

  // No token needed — the tq_auth cookie is injected by the proxy automatically
  const onDemandMutation = useMutation({
    mutationFn: () => makeAPICallV1('drops/on-demand', { method: 'POST' }),
    onSuccess: (data) => {
      // In a real flow, this would redirect to the active drop page (/drop/[id])
      console.log('Drop granted!', data);
      alert('Drop Granted! Check your mobile app to play.');
    },
    onError: (err: unknown) => {
      if (err instanceof APIError && err.code === 'UPGRADE_REQUIRED') {
        setIsPaywallVisible(true);
      } else {
        console.error(err);
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

      {isPaywallVisible && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
          <div className='w-full max-w-sm bg-white rounded-2xl p-8 text-center shadow-2xl transform transition-all'>
            <h3 className='text-2xl font-bold text-purple-600 mb-4'>Premium Paywall</h3>
            <p className='text-gray-700 mb-8 leading-relaxed'>Want more trivia right now? Premium allows up to 100 questions a day and instant drops.</p>
            <button onClick={() => setIsPaywallVisible(false)} className='w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-purple-700 transition-colors'>
              Coming Soon!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
