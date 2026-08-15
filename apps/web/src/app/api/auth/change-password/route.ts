import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';

const FIREBASE_LOGIN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('tq_auth')?.value;
  if (!sessionToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = (await req.json()) || {};

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ message: 'Missing password fields' }, { status: 400 });
    }

    // 1. Look up the user's email from the backend (session cookie as Bearer).
    const meRes = await fetch(new URL('/v1/users/me', env.API_URL).toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!meRes.ok) {
      return NextResponse.json({ message: 'Could not find user email' }, { status: 400 });
    }

    const me = await meRes.json();
    const email = me?.email;
    if (!email) {
      return NextResponse.json({ message: 'Could not find user email' }, { status: 400 });
    }

    // 2. Re-authenticate (verify old password) server-side against Firebase.
    const verifyRes = await fetch(`${FIREBASE_LOGIN_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: oldPassword, returnSecureToken: true }),
    });

    if (!verifyRes.ok) {
      return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    // 3. Update the password via the backend (Admin SDK) using the session cookie.
    const updateRes = await fetch(new URL('/v1/auth/change-password', env.API_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ newPassword }),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json().catch(() => ({}));
      return NextResponse.json({ message: errorData.error || 'Failed to update password' }, { status: updateRes.status });
    }

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[change-password] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
