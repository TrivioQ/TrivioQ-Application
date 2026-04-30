import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../env.mjs';

// ---------------------------------------------------------------------------
// Catch-all proxy: /api/[...slug]  →  env.API_URL/[...slug]
//
// The real backend URL (API_URL) is a *server-only* env variable and never
// reaches the browser bundle. Clients call /api/v1/... as a same-origin
// request; this handler forwards it transparently to the backend.
//
// Authentication: the `tq_auth` httpOnly cookie (set by /api/auth/sync) is
// read server-side and injected as the Authorization header. The client never
// touches the token directly.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'tq_auth';
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

// Headers that must not be forwarded to the upstream or back to the client.
const HOP_BY_HOP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'proxy-authorization', 'te', 'trailer']);

async function handleRequest(req: NextRequest): Promise<NextResponse> {
  // Strip the leading /api prefix so /api/v1/drops/... → v1/drops/...
  const slug = req.nextUrl.pathname.replace(/^\/api\/?/i, '');
  const upstreamUrl = new URL(slug, env.API_URL);
  upstreamUrl.search = req.nextUrl.search;

  // Forward all incoming headers except hop-by-hop ones and the client's
  // Authorization header (we inject our own from the cookie below).
  const forwardedHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'authorization') {
      forwardedHeaders.set(key, value);
    }
  });
  forwardedHeaders.set('content-type', 'application/json');

  // Inject the session token from the httpOnly cookie as the Authorization header.
  const sessionToken = req.cookies.get(COOKIE_NAME)?.value;
  if (sessionToken) {
    forwardedHeaders.set('authorization', `Bearer ${sessionToken}`);
  }

  const upstreamInit: RequestInit = {
    method: req.method,
    headers: forwardedHeaders,
  };

  if (METHODS_WITH_BODY.has(req.method)) {
    try {
      upstreamInit.body = JSON.stringify(await req.json());
    } catch {
      // Body may be empty — that's fine
    }
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), upstreamInit);

    // 204 No Content — return an empty 204 to the client
    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => null);

      // Forward safe upstream response headers to the client
      const responseHeaders = new Headers();
      upstream.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });

      const response = NextResponse.json(errorData || { message: 'Upstream error' }, {
        status: upstream.status,
        headers: responseHeaders,
      });

      // Automatically clear the auth cookie if the session has expired
      if (upstream.status === 401 && errorData?.code === 'auth/id-token-expired') {
        response.cookies.delete(COOKIE_NAME);
      }

      return response;
    }

    const data = await upstream.json();

    // Forward safe upstream response headers to the client
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return NextResponse.json(data, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API Proxy] Upstream fetch failed:', error);
    return NextResponse.json({ message: 'Upstream request failed', code: 'PROXY_ERROR' }, { status: 502 });
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
