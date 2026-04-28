import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { makeServerAPICallV1 } from '../../lib/api-server';
import { SettingsForm } from './settings-form';

export const metadata = {
  title: 'Settings | TrivioQ',
  description: 'Manage your account settings and trivia preferences.',
};

export default async function SettingsPage() {
  const hasCookie = !!cookies().get('tq_auth');

  if (!hasCookie) {
    redirect('/login');
  }

  let user = null;
  try {
    user = await makeServerAPICallV1<any>('users/me');
  } catch (err) {
    console.error('[SettingsPage] Failed to fetch user:', err);
    // If we can't even fetch the user, something is wrong with auth
    redirect('/login');
  }

  return (
    <div className='min-h-screen bg-gray-950 text-white selection:bg-indigo-500 selection:text-white pb-20'>
      <div className='max-w-3xl mx-auto px-6 py-16 space-y-12'>
        {/* ── Header ── */}
        <div>
          <h1 className='text-4xl font-extrabold tracking-tight text-white'>Settings</h1>
          <p className='text-gray-400 mt-2'>Manage your preferences and account security.</p>
        </div>

        <SettingsForm initialUser={user} />
      </div>
    </div>
  );
}
