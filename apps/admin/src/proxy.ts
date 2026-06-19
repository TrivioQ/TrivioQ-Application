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

  // Inject x-url header so Server Actions can read the current pathname
  response.headers.set('x-url', pathname);

  if (isPublic) {
    return response;
  }

  const redirectToLogin = (errorMsg: string, isExpired = false) => {
    const loginUrl = new URL('/en/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    loginUrl.searchParams.set('error', errorMsg);
    const res = NextResponse.redirect(loginUrl);
    if (isExpired) {
      res.cookies.delete('tq_auth');
    }
    return res;
  };

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
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });

    if (!meRes.ok) {
      const errorData = await meRes.json().catch(() => ({}));
      const isExpired = meRes.status === 401 && errorData.code === 'auth/id-token-expired';
      const isNotAuthenticated = meRes.status === 401 && !isExpired;
      // Show error only for expired sessions or non-admin roles, not for first-time visitors
      const errorMsg = isExpired ? 'Session Expired' : isNotAuthenticated ? '' : 'Unauthorized Access';
      return redirectToLogin(errorMsg, isExpired);
    }

    const data = (await meRes.json()) as { role?: string };
    if (data.role !== 'ADMIN') {
      return redirectToLogin('Unauthorized Access');
    }

    return response;
  } catch (err) {
    console.error('[middleware] auth check failed exception:', err);
    return redirectToLogin('Unauthorized Access');
  }
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
