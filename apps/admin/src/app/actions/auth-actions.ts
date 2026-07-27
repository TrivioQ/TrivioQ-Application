'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { env } from 'env';

const FIREBASE_SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const COOKIE_NAME = 'tq_auth';
const COOKIE_MAX_AGE_14_DAYS = 60 * 60 * 24 * 14;

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const keepMeLoggedIn = formData.get('keepMeLoggedIn') === 'on';

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  let idToken: string;

  try {
    const firebaseRes = await fetch(`${FIREBASE_SIGN_IN_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      console.log('[loginAction] Firebase auth failed:', firebaseData);
      const code = firebaseData?.error?.message ?? '';
      if (code === 'EMAIL_NOT_FOUND' || code === 'INVALID_PASSWORD' || code === 'INVALID_LOGIN_CREDENTIALS') {
        return { error: 'Invalid email or password.' };
      }
      if (code === 'USER_DISABLED') return { error: 'This account has been disabled.' };
      if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') return { error: 'Too many attempts. Please try again later.' };
      return { error: 'Authentication failed. Please try again.' };
    }

    idToken = firebaseData.idToken;
  } catch (err) {
    console.error('[loginAction] Firebase REST call failed:', err);
    return { error: 'Authentication service unavailable.' };
  }

  const apiUrl = env.API_URL;
  try {
    console.log('[loginAction] Sending sync request to backend API:', `${apiUrl}/v1/auth/sync`);
    const upstream = await fetch(`${apiUrl}/v1/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('[loginAction] Backend sync failed with status:', upstream.status, errorText);
      return { error: 'Authentication service unavailable.' };
    }

    const user = await upstream.json();
    console.log('[loginAction] Backend sync user response:', user);

    if (!user || user.role !== 'ADMIN') {
      console.warn('[loginAction] Access denied - user is not ADMIN:', user);
      return { error: 'Access denied. Administrator privileges required.' };
    }
  } catch (err: unknown) {
    console.error('[loginAction] Backend check failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { error: errorMessage || 'An unexpected error occurred' };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(keepMeLoggedIn ? { maxAge: COOKIE_MAX_AGE_14_DAYS } : {}),
  });

  const locale = await getLocale();
  const headersList = await headers();
  const referer = headersList.get('referer');
  let destination = `/${locale}`;

  if (referer) {
    try {
      const url = new URL(referer);
      const callbackUrl = url.searchParams.get('callbackUrl');
      if (callbackUrl && callbackUrl.startsWith('/')) {
        destination = callbackUrl;
      }
    } catch (e) {
      console.error('[loginAction] Invalid callback URL:', e);
    }
  }

  redirect(destination);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect('/login');
}
