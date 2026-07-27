import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { GetStartedWizard } from './get-started-wizard';

interface UserProfile {
  onboardingComplete: boolean;
}

export const dynamic = 'force-dynamic';

export default async function GetStartedPage() {
  const hasCookie = !!cookies().get('tq_auth');
  if (!hasCookie) {
    redirect('/login?callbackUrl=/get-started');
  }

  let profile: UserProfile | null = null;
  try {
    profile = await makeServerAPICallV1<UserProfile>('users/me');
  } catch {
    // ignore — user hitting wizard even on a transient failure is fine
  }

  if (profile && profile.onboardingComplete === true) {
    redirect('/dashboard');
  }

  return <GetStartedWizard />;
}
