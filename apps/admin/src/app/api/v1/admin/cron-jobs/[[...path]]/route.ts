import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3013';

async function proxy(request: NextRequest, context: { params: { path?: string[] } }) {
  try {
    const pathArray = context.params.path || [];
    const pathString = pathArray.join('/');
    const url = new URL(request.url);
    
    // Construct the backend URL
    const backendUrl = `${API_BASE}/v1/admin/cron-jobs${pathString ? `/${pathString}` : ''}${url.search}`;
    
    // Copy relevant headers
    const headers = new Headers();
    if (request.headers.has('cookie')) headers.set('cookie', request.headers.get('cookie')!);
    if (request.headers.has('content-type')) headers.set('content-type', request.headers.get('content-type')!);

    const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    if (!response.ok) {
      // Return error string or object
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying cron job request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
