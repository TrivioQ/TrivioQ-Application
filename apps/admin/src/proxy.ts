import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['en'],
  defaultLocale: 'en'
});

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Handle locale routing with next-intl
  const response = intlMiddleware(req);

  // 2. Auth check logic
  // Check if route is public (considering locale prefix)
  const isPublic =
    pathname.match(/^\/(en)?\/?login/) ||
    pathname.match(/^\/(en)?\/?403/) ||
    pathname.startsWith('/api/auth/me');

  if (isPublic) {
    return response;
  }

  // Fast pre-check: cookie missing
  const sessionCookie = req.cookies.get('tq_auth');
  if (!sessionCookie) {
    const loginUrl = new URL('/en/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify role via internal API
  try {
    const meUrl = new URL('/api/auth/me', req.url);
    const meRes = await fetch(meUrl.toString(), {
      headers: {
        cookie: req.headers.get('cookie') ?? '',
      },
    });

    if (!meRes.ok) {
      const errorData = await meRes.json().catch(() => ({}));
      if (meRes.status === 401 && errorData.code === 'auth/id-token-expired') {
        const loginUrl = new URL('/en/login', req.url);
        loginUrl.searchParams.set('error', 'Session Expired');
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('tq_auth');
        return res;
      }
      return NextResponse.redirect(new URL('/en/login?error=Unauthorized Access', req.url));
    }

    const data = (await meRes.json()) as { role?: string };
    if (data.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/en/login?error=Unauthorized Access', req.url));
    }

    return response;
  } catch (err) {
    console.error('[middleware] auth check failed:', err);
    return NextResponse.redirect(new URL('/en/login?error=Unauthorized Access', req.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
