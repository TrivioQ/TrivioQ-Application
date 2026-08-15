import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'env';

const COOKIE_NAME = 'tq_auth';

export async function AdminGuard({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  try {
    // Verify the session cookie via the backend /v1/users/me endpoint, which
    // runs under the dual-mode (session-cookie-aware) requireSession middleware.
    const upstream = await fetch(new URL('/v1/users/me', env.API_URL).toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
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
