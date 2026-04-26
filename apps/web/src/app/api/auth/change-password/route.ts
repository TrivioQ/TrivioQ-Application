import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../../env.mjs';

const FIREBASE_LOGIN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const FIREBASE_UPDATE_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:update';

export async function POST(req: NextRequest) {
  const idToken = req.cookies.get('tq_auth')?.value;
  if (!idToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = (await req.json()) || {};

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ message: 'Missing password fields' }, { status: 400 });
    }

    // 1. Get the current user's email first
    const meRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    const meData = await meRes.json();
    const email = meData.users?.[0]?.email;

    if (!email) {
      return NextResponse.json({ message: 'Could not find user email' }, { status: 400 });
    }

    // 2. Re-authenticate (verify old password)
    const verifyRes = await fetch(`${FIREBASE_LOGIN_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ email, password: oldPassword, returnSecureToken: true }),
    });

    if (!verifyRes.ok) {
      // const errorData = await verifyRes.json();
      return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    // 3. Update password
    const updateRes = await fetch(`${FIREBASE_UPDATE_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json();
      return NextResponse.json({ message: errorData.error?.message || 'Failed to update password' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[change-password] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
