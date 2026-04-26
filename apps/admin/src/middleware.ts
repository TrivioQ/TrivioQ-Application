import { NextRequest, NextResponse } from 'next/server';

/**
 * Runs on the Edge runtime — no Prisma, no Node.js APIs.
 * For role verification it calls the internal /api/auth/me Route Handler
 * which runs in the Node.js runtime and can use Prisma.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Public routes — always allow through ──────────────────────────────────
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/403') ||
    pathname.startsWith('/api/auth/me'); // prevent recursive self-calls

  if (isPublic) {
    return NextResponse.next();
  }

  // ── Fast pre-check: cookie missing → redirect immediately ─────────────────
  const sessionCookie = req.cookies.get('firebase-token');

  if (!sessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Call the internal /api/auth/me handler to verify role ─────────────────
  try {
    const meUrl = new URL('/api/auth/me', req.url);
    const meRes = await fetch(meUrl.toString(), {
      headers: {
        // Forward the session cookie to the internal route handler
        cookie: req.headers.get('cookie') ?? '',
      },
    });

    if (!meRes.ok) {
      // Cookie exists but user not found or DB error → redirect to login
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('error', 'Unauthorized Access');
      return NextResponse.redirect(loginUrl);
    }

    const data = (await meRes.json()) as { role?: string };

    if (data.role !== 'ADMIN') {
      // Valid user but not an admin
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('error', 'Unauthorized Access');
      return NextResponse.redirect(loginUrl);
    }

    // ADMIN confirmed — allow the request through
    return NextResponse.next();
  } catch (err) {
    // Network/fetch error calling internal endpoint — fail closed
    console.error('[middleware] auth check failed:', err);
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'Unauthorized Access');
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // Run on every route EXCEPT static assets, images, and favicons
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
