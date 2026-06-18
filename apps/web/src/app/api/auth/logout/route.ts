import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/auth/logout
//
// Clears the `tq_auth` session cookie. The client should also call
// Firebase's signOut() to revoke the Firebase session on the client side.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'tq_auth';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
