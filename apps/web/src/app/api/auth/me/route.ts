import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';

// ---------------------------------------------------------------------------
// GET /api/auth/me
//
// Reads the tq_auth httpOnly cookie (a Firebase session cookie after the
// session-cookie migration) and forwards it to the backend /v1/users/me,
// which verifies it server-side via the Firebase Admin SDK and returns the
// user record. Returns the session user's uid, email, displayName, photoUrl,
// and auth providers.
// Returns 401 when no valid session exists.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'tq_auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ message: 'No session' }, { status: 401 });
  }

  try {
    const res = await fetch(new URL('/v1/users/me', env.API_URL).toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json({ message: errorData.error || 'Invalid or expired session', code: errorData.code }, { status: 401 });
    }

    const user = await res.json();
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({
      uid: user.id,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoUrl: null,
      providers: [],
    });
  } catch (err) {
    console.error('[/api/auth/me] Backend check failed:', err);
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }
}
