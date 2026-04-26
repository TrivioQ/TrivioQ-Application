import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../../env.mjs';

// ---------------------------------------------------------------------------
// POST /api/auth/login
//
// Accepts { email, password } from the browser.
// Calls Firebase REST API (signInWithPassword) SERVER-SIDE — the Firebase
// API key never reaches the browser bundle.
// On success: syncs user to Postgres, sets the tq_auth httpOnly cookie.
// ---------------------------------------------------------------------------

const FIREBASE_SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

const COOKIE_NAME = 'tq_auth';
const COOKIE_MAX_AGE_SECONDS = 60 * 60; // 1 hour — matches Firebase idToken TTL

export async function POST(req: NextRequest): Promise<NextResponse> {
  let email: string | undefined;
  let password: string | undefined;

  try {
    const body = await req.json();
    email = body?.email;
    password = body?.password;
  } catch {
    // fall through
  }

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  // ── Step 1: Authenticate with Firebase REST API (server-side) ─────────────
  let idToken: string;
  try {
    const firebaseRes = await fetch(`${FIREBASE_SIGN_IN_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      const code = firebaseData?.error?.message ?? 'UNKNOWN_ERROR';
      const message = mapFirebaseError(code);
      return NextResponse.json({ message, code }, { status: 401 });
    }

    idToken = firebaseData.idToken;
  } catch (err) {
    console.error('[/api/auth/login] Firebase REST call failed:', err);
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }

  // ── Step 2: Sync user record in Postgres ──────────────────────────────────
  return syncAndRespond(idToken);
}

/** Map Firebase error codes to user-friendly messages. */
function mapFirebaseError(code: string): string {
  switch (code) {
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'Invalid email or password.';
    case 'USER_DISABLED':
      return 'This account has been disabled.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

/** Shared helper: calls backend sync, sets cookie, returns response. */
export async function syncAndRespond(idToken: string): Promise<NextResponse> {
  try {
    const upstream = await fetch(new URL('/v1/auth/sync', env.API_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('[auth] Backend sync failed:', upstream.status, errorText);
      return NextResponse.json({ message: 'Backend synchronization failed', details: errorText }, { status: upstream.status });
    }

    const data = await upstream.json();

    const response = NextResponse.json(data, { status: 200 });
    response.cookies.set(COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[auth] Backend sync failed:', err);
    return NextResponse.json({ message: 'Auth sync failed', code: 'PROXY_ERROR' }, { status: 502 });
  }
}
