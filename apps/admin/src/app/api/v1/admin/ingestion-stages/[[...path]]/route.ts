import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3013';

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const params = await context.params;
    const pathArray = params.path || [];
    const pathString = pathArray.join('/');
    const url = new URL(request.url);

    const backendUrl = `${API_BASE}/v1/admin/ingestion-stages${pathString ? `/${pathString}` : ''}${url.search}`;

    const headers = new Headers();
    if (request.headers.has('cookie')) headers.set('cookie', request.headers.get('cookie')!);
    if (request.headers.has('content-type')) headers.set('content-type', request.headers.get('content-type')!);

    if (request.headers.has('authorization')) {
      headers.set('authorization', request.headers.get('authorization')!);
    } else {
      const token = request.cookies.get('tq_auth')?.value;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
    }

    const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Error proxying ingestion-stages request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
