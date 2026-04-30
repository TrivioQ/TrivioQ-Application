import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['en'],
  defaultLocale: 'en',
});

// Routes that require an authenticated session cookie.
// Matched against the pathname *after* stripping the locale prefix.
const PROTECTED_SEGMENTS = ['/dashboard', '/settings', '/score-history'];

function isProtected(pathname: string): boolean {
  // Strip optional locale prefix, e.g. /en/dashboard → /dashboard
  const withoutLocale = pathname.replace(/^\/(en)(\/|$)/, '/');
  return PROTECTED_SEGMENTS.some((seg) => withoutLocale === seg || withoutLocale.startsWith(seg + '/'));
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isProtected(pathname) && !req.cookies.get('tq_auth')) {
    const loginUrl = new URL('/en/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
}

export const config = {
  // Exclude API routes, static files, and Next.js internals — same as before.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
