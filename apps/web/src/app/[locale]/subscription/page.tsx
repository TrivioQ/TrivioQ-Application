import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SubscriptionSettings } from '@/components/subscription-settings';

export const metadata = {
  title: 'Subscription | TrivioQ',
  description: 'Manage your TrivioQ subscription and premium vault.',
};

export default async function SubscriptionPage() {
  const hasCookie = !!cookies().get('tq_auth');
  if (!hasCookie) redirect('/login');

  return (
    <div className='min-h-screen bg-gray-950 text-white selection:bg-indigo-500 selection:text-white pb-20'>
      <div className='max-w-3xl mx-auto px-6 py-16 space-y-12'>
        <div>
          <h1 className='text-4xl font-extrabold tracking-tight text-white'>Subscription</h1>
          <p className='text-gray-400 mt-2'>Manage your plan and activate banked premium days.</p>
        </div>

        <SubscriptionSettings />
      </div>
    </div>
  );
}
