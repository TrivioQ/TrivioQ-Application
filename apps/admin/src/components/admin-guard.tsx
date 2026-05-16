import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'env';

const COOKIE_NAME = 'tq_auth';

export async function AdminGuard({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const idToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!idToken) {
    redirect('/login');
  }

  try {
    const upstream = await fetch(new URL('/v1/auth/sync', env.API_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!upstream.ok) {
      redirect('/login');
    }

    const user = await upstream.json();

    if (!user || user.role !== 'ADMIN') {
      redirect('/403');
    }
  } catch {
    redirect('/login');
  }

  return <>{children}</>;
}
