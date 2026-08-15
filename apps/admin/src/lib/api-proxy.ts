import { NextRequest, NextResponse } from 'next/server';

/**
 * Builds a proxy handler that forwards requests to an internal backend service.
 *
 * SSE safety: when the backend responds with `text/event-stream`, chunks are
 * piped through a no-op TransformStream so they flow to the client immediately.
 * Without this, Node's `fetch` buffers the **entire** SSE stream in the heap
 * before returning — for long-lived streams this causes OOM crashes.
 */
export function createProxyHandler(
  apiBase: string,
  routePrefix: string,
  errorLabel: string,
) {
  return async function proxy(
    request: NextRequest,
    context: { params: Promise<{ path?: string[] }> },
  ): Promise<NextResponse> {
    try {
      const params = await context.params;
      const pathString = (params.path ?? []).join('/');
      const url = new URL(request.url);

      const backendUrl = `${apiBase}${routePrefix}${pathString ? `/${pathString}` : ''}${url.search}`;

      const headers = new Headers();
      if (request.headers.has('cookie'))
        headers.set('cookie', request.headers.get('cookie')!);
      if (request.headers.has('content-type'))
        headers.set('content-type', request.headers.get('content-type')!);

      if (request.headers.has('authorization')) {
        headers.set('authorization', request.headers.get('authorization')!);
      } else {
        const token = request.cookies.get('tq_auth')?.value;
        if (token) headers.set('authorization', `Bearer ${token}`);
      }

      // Stream the body directly to avoid buffering large multipart payloads
      // (e.g. PDF uploads) in the proxy heap. Using arrayBuffer() would
      // materialise the entire file twice — once here and once in Express —
      // effectively doubling the upload time for large files. Passing
      // request.body (a ReadableStream) lets bytes flow straight through.
      const body =
        request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body
          : undefined;

      const response = await fetch(backendUrl, {
        method: request.method,
        headers,
        body,
        // Prevent Node.js from buffering the response body before returning.
        // Critical for SSE: without this the entire stream is held in the heap.
        cache: 'no-store',
        // `duplex: 'half'` is required by Node 18+ undici when the request body
        // is a ReadableStream (streaming uploads). It is not part of the standard
        // browser RequestInit type, so we cast through `unknown` to satisfy TS
        // while preserving the correct runtime behaviour.
        ...(body ? { duplex: 'half' } : {}),
      } as unknown as RequestInit);

      const contentType = response.headers.get('content-type') ?? '';

      // SSE path — stream chunks immediately via a pass-through TransformStream.
      if (contentType.includes('text/event-stream') && response.body) {
        const { readable, writable } = new TransformStream();
        response.body.pipeTo(writable).catch(() => {
          // Client disconnected early — silently ignore.
        });

        return new NextResponse(readable, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }

      // All other responses (JSON, binary downloads, etc.)
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.error(`Error proxying ${errorLabel} request:`, error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
