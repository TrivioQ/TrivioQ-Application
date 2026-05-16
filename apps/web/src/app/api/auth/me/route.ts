import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';

// ---------------------------------------------------------------------------
// GET /api/auth/me
//
// Reads the tq_auth httpOnly cookie and verifies it with Firebase REST API.
// Returns the session user's uid, email, displayName, and photoUrl.
// Returns 401 when no valid session exists.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'tq_auth';
const FIREBASE_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const idToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!idToken) {
    return NextResponse.json({ message: 'No session' }, { status: 401 });
  }

  try {
    const res = await fetch(`${FIREBASE_LOOKUP_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const data = await res.json();

    if (!res.ok || !data.users?.[0]) {
      return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 });
    }

    const firebaseUser = data.users[0];
    return NextResponse.json({
      uid: firebaseUser.localId,
      email: firebaseUser.email ?? null,
      displayName: firebaseUser.displayName ?? null,
      photoUrl: firebaseUser.photoUrl ?? null,
      providers: (firebaseUser.providerUserInfo ?? []).map((p: any) => p.providerId),
    });
  } catch (err) {
    console.error('[/api/auth/me] Firebase lookup failed:', err);
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }
}
