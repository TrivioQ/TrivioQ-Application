import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../../env.mjs';

// ---------------------------------------------------------------------------
// POST /api/auth/sync
//
// Explicit auth route — NOT caught by the [...slug] proxy.
// Responsibilities:
//   1. Forward the client's Firebase idToken to the backend to sync/create the user.
//   2. Store the Firebase idToken in an httpOnly cookie (`tq_auth`) so subsequent
//      requests through the proxy are authenticated without the client ever
//      touching the token again.
//
// Future: when the backend issues its own JWT (with subscription claims), swap
// cookie value to that JWT — zero client-side changes required.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'tq_auth';

// Firebase idTokens expire after 1 hour. We match that so the cookie stays
// valid for exactly as long as the token itself. The client (Firebase SDK)
// will refresh the idToken silently; the next login/page load will issue a
// new cookie.
const COOKIE_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export async function POST(req: NextRequest): Promise<NextResponse> {
  let idToken: string | undefined;

  try {
    const body = await req.json();
    idToken = body?.idToken;
  } catch {
    // fall through to the missing token check below
  }

  if (!idToken) {
    return NextResponse.json({ message: 'Missing idToken in request body' }, { status: 401 });
  }

  try {
    const upstream = await fetch(new URL('v1/auth/sync', env.API_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    // Build the response — return the user payload to the client
    const response = NextResponse.json(data, { status: 200 });

    // Set the httpOnly session cookie.
    // - httpOnly:  JS cannot read it (XSS protection)
    // - secure:    HTTPS only in production
    // - sameSite:  lax — safe for top-level navigations, blocks CSRF from
    //              cross-origin POSTs
    response.cookies.set(COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[/api/auth/sync] Upstream fetch failed:', error);
    return NextResponse.json({ message: 'Auth sync failed', code: 'PROXY_ERROR' }, { status: 502 });
  }
}
