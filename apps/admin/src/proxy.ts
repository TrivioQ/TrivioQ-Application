import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['en'],
  defaultLocale: 'en',
});

export async function proxy(req: NextRequest) {
  // Fix Cloudflare Tunnel missing X-Forwarded-Port header to prevent Next.js from appending :3012
  req.headers.set('x-forwarded-port', '443');

  const { pathname } = req.nextUrl;

  // 1. Handle locale routing with next-intl
  const response = intlMiddleware(req);

  // 2. Auth check logic
  // Check if route is public (considering locale prefix)
  const isPublic = pathname.match(/^\/(en)?\/?login/) || pathname.match(/^\/(en)?\/?403/) || pathname.startsWith('/api/auth/me');

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

    // In production (Docker/Cloudflare), use local container address to bypass external routing loops
    if (process.env.NODE_ENV === 'production') {
      meUrl.protocol = 'http:';
      meUrl.hostname = '127.0.0.1';
      meUrl.port = process.env.PORT || '3012';
    }

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
    console.error('[middleware] auth check failed exception:', err);
    return NextResponse.redirect(new URL('/en/login?error=Unauthorized Access', req.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
