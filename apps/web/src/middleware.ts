import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['en'],
  defaultLocale: 'en',
});

// Routes that require an authenticated session cookie.
// Matched against the pathname *after* stripping the locale prefix.
const PROTECTED_SEGMENTS = ['/dashboard', '/settings', '/score-history', '/get-started'];

function isProtected(pathname: string): boolean {
  // Strip optional locale prefix, e.g. /en/dashboard → /dashboard
  const withoutLocale = pathname.replace(/^\/(en)(\/|$)/, '/');
  return PROTECTED_SEGMENTS.some((seg) => withoutLocale === seg || withoutLocale.startsWith(seg + '/'));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Fix Cloudflare Tunnel missing X-Forwarded-Port header to prevent Next.js from appending :3011
  req.headers.set('x-forwarded-port', '443');

  const { pathname } = req.nextUrl;

  if (isProtected(pathname) && !req.cookies.get('tq_auth')) {
    const loginUrl = new URL('/en/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = intlMiddleware(req);
  response.headers.set('x-url', pathname);
  return response;
}

export const config = {
  // Exclude API routes, static files, and Next.js internals — same as before.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
