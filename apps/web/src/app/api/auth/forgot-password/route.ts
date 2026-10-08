import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
//
// Accepts { email } and asks Firebase to send its password-reset email
// (REST sendOobCode, server-side so the API key stays off the client).
// Always responds 200 for well-formed input so the endpoint can't be used to
// discover which emails have accounts.
// ---------------------------------------------------------------------------

const FIREBASE_OOB_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { email } = ((await req.json().catch(() => ({}))) ?? {}) as { email?: unknown };

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return NextResponse.json({ message: 'A valid email is required.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${FIREBASE_OOB_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: email.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const code: string = data?.error?.message ?? '';
      // Only rate limiting is surfaced; EMAIL_NOT_FOUND etc. are swallowed on purpose.
      if (code.startsWith('TOO_MANY_ATTEMPTS')) {
        return NextResponse.json({ message: 'Too many attempts. Please try again later.' }, { status: 429 });
      }
      console.warn('[forgot-password] Firebase sendOobCode failed:', code);
    }
  } catch (error) {
    console.error('[forgot-password] Request failed:', error);
  }

  return NextResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
}
