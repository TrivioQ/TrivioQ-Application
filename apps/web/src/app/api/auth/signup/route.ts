import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';
import { syncAndRespond } from '../login/route';

// ---------------------------------------------------------------------------
// POST /api/auth/signup
//
// Accepts { email, password } from the browser.
// Calls Firebase REST API (signUp) SERVER-SIDE — API key stays on the server.
// On success: syncs user to Postgres, sets the tq_auth httpOnly cookie.
// ---------------------------------------------------------------------------

const FIREBASE_SIGN_UP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let email: string | undefined;
  let password: string | undefined;
  let username: string | undefined;
  let displayName: string | undefined;
  let dateOfBirth: string | undefined;
  let referralCode: string | undefined;

  try {
    const body = await req.json();
    email = body?.email;
    password = body?.password;
    username = body?.username;
    displayName = body?.displayName;
    dateOfBirth = body?.dateOfBirth;
    referralCode = body?.referralCode || undefined;
  } catch {
    // fall through
  }

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  if (!username || username.trim().length < 3) {
    return NextResponse.json({ message: 'Username must be at least 3 characters' }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return NextResponse.json({ message: 'Username may only contain letters, numbers, underscores, and periods' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
  }

  if (!dateOfBirth) {
    return NextResponse.json({ message: 'Date of birth is required' }, { status: 400 });
  }

  const dobParts = dateOfBirth.split('-');
  if (dobParts.length !== 3) {
    return NextResponse.json({ message: 'Invalid date of birth format' }, { status: 400 });
  }

  const dobYear = parseInt(dobParts[0], 10);
  const dobMonth = parseInt(dobParts[1], 10);
  const dobDay = parseInt(dobParts[2], 10);

  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  let age = currentYear - dobYear;
  if (currentMonth < dobMonth || (currentMonth === dobMonth && currentDay < dobDay)) {
    age--;
  }

  if (age < 13) {
    return NextResponse.json({ message: 'You must be at least 13 years old to create an account.' }, { status: 400 });
  }

  // ── Step 1: Create account with Firebase REST API (server-side) ───────────
  let idToken: string;
  try {
    const firebaseRes = await fetch(`${FIREBASE_SIGN_UP_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      const code = firebaseData?.error?.message ?? 'UNKNOWN_ERROR';
      const message = mapFirebaseSignupError(code);
      return NextResponse.json({ message, code }, { status: 400 });
    }

    idToken = firebaseData.idToken;
  } catch (err) {
    console.error('[/api/auth/signup] Firebase REST call failed:', err);
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }

  // ── Step 2: Sync user record in Postgres ──────────────────────────────────
  return syncAndRespond(idToken, { username: username.toLowerCase(), displayName: displayName ?? username, dateOfBirth, ...(referralCode ? { referralCode } : {}) });
}

function mapFirebaseSignupError(code: string): string {
  switch (code) {
    case 'EMAIL_EXISTS':
      return 'An account with this email already exists.';
    case 'WEAK_PASSWORD':
      return 'Password must be at least 6 characters.';
    case 'INVALID_EMAIL':
      return 'Please enter a valid email address.';
    case 'OPERATION_NOT_ALLOWED':
      return 'Email/password sign-up is not enabled. Please contact support.';
    default:
      return 'Sign-up failed. Please try again.';
  }
}
