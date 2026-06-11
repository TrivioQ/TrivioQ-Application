import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';
import { syncAndRespond } from '../../login/route';

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
//
// Handles the Google OAuth 2.0 callback entirely server-side:
//   1. Verifies the CSRF state cookie.
//   2. Exchanges the authorization code for a Google ID token.
//   3. Exchanges the Google ID token for a Firebase ID token via REST API.
//   4. Syncs the user to Postgres and sets the tq_auth httpOnly cookie.
//   5. Redirects to /dashboard.
// ---------------------------------------------------------------------------

const STATE_COOKIE = 'tq_oauth_state';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_SIGN_IN_WITH_IDP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied access on the Google consent screen.
  if (error) {
    return NextResponse.redirect(new URL('/login?error=google_denied', env.APP_URL));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', env.APP_URL));
  }

  // ── Step 1: Verify CSRF state ─────────────────────────────────────────────
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(new URL('/login?error=state_mismatch', env.APP_URL));
  }

  const redirectUri = `${env.APP_URL}/api/auth/google/callback`;

  // ── Step 2: Exchange code for Google tokens ───────────────────────────────
  let googleIdToken: string;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('[/api/auth/google/callback] Google token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/login?error=google_token_failed', env.APP_URL));
    }

    googleIdToken = tokenData.id_token;
  } catch (err) {
    console.error('[/api/auth/google/callback] Google token exchange error:', err);
    return NextResponse.redirect(new URL('/login?error=google_token_failed', env.APP_URL));
  }

  // ── Step 3: Exchange Google ID token for Firebase ID token ────────────────
  let firebaseIdToken: string;
  try {
    const idpRes = await fetch(`${FIREBASE_SIGN_IN_WITH_IDP_URL}?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: env.APP_URL,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    });

    const idpData = await idpRes.json();

    if (!idpRes.ok || !idpData.idToken) {
      console.error('[/api/auth/google/callback] Firebase signInWithIdp failed:', idpData);
      return NextResponse.redirect(new URL('/login?error=firebase_auth_failed', env.APP_URL));
    }

    firebaseIdToken = idpData.idToken;
  } catch (err) {
    console.error('[/api/auth/google/callback] Firebase signInWithIdp error:', err);
    return NextResponse.redirect(new URL('/login?error=firebase_auth_failed', env.APP_URL));
  }

  // ── Step 4: Sync to Postgres + set cookie ─────────────────────────────────
  const syncResponse = await syncAndRespond(firebaseIdToken);

  // syncAndRespond returns a JSON response — we need to forward the cookie
  // and redirect to the dashboard instead.
  const authCookie = syncResponse.cookies.get('tq_auth');
  if (!authCookie || syncResponse.status !== 200) {
    return NextResponse.redirect(new URL('/login?error=sync_failed', env.APP_URL));
  }

  const redirectResponse = NextResponse.redirect(new URL('/dashboard', env.APP_URL));

  // Clear the CSRF state cookie and forward the session cookie.
  redirectResponse.cookies.set('tq_oauth_state', '', { maxAge: 0, path: '/' });
  redirectResponse.cookies.set('tq_auth', authCookie.value, {
    httpOnly: true,
    secure: (process.env.APP_URL ?? '').startsWith('https://'),
    sameSite: 'lax',
    maxAge: authCookie.maxAge,
    path: '/',
  });

  return redirectResponse;
}
