import { NextResponse } from 'next/server';
import { env } from 'env';

// ---------------------------------------------------------------------------
// GET /api/auth/google
//
// Initiates the Google OAuth 2.0 authorization code flow entirely server-side.
// Redirects the browser to Google's consent screen. No Firebase client SDK
// or API keys are ever sent to the browser.
//
// The tq_oauth_state cookie is set for CSRF protection and verified in the
// callback handler at /api/auth/google/callback.
// ---------------------------------------------------------------------------

const STATE_COOKIE = 'tq_oauth_state';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export async function GET(): Promise<NextResponse> {
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
