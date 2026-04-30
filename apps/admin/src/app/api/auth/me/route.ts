import { NextRequest, NextResponse } from 'next/server';
const COOKIE_NAME = 'tq_auth';

/**
 * Internal-only Route Handler — called exclusively by the middleware.
 * Verifies the tq_auth Firebase idToken, looks up the user in the DB, and returns their role.
 */
export async function GET(req: NextRequest) {
  const idToken = req.cookies.get(COOKIE_NAME)?.value;

  if (!idToken) {
    return NextResponse.json({ error: 'No session cookie' }, { status: 401 });
  }

  try {
    const upstream = await fetch(new URL('/v1/users/me', process.env.API_URL).toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return NextResponse.json({ 
        error: errorData.error || 'Invalid or expired session',
        code: errorData.code 
      }, { status: 401 });
    }

    const user = await upstream.json();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({ role: user.role, email: user.email }, { status: 200 });
  } catch (err) {
    console.error('[/api/auth/me] Backend check failed:', err);
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }
}
