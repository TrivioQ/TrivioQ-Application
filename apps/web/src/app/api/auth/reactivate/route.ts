import { NextRequest, NextResponse } from 'next/server';
import { env } from 'env';
import { syncAndRespond } from '../login/route';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let idToken: string | undefined;

  try {
    const body = await req.json();
    idToken = body?.idToken;
  } catch {
    // fall through
  }

  if (!idToken) {
    return NextResponse.json({ message: 'idToken is required' }, { status: 400 });
  }

  try {
    // Call backend to reactivate
    const upstream = await fetch(new URL('/v1/auth/reactivate', env.API_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('[/api/auth/reactivate] Backend reactivation failed:', upstream.status, errorText);
      return NextResponse.json({ message: 'Reactivation failed', details: errorText }, { status: upstream.status });
    }

    // Now sync and respond to set the cookie (using the shared helper from login)
    return syncAndRespond(idToken);
  } catch (err) {
    console.error('[/api/auth/reactivate] Error:', err);
    return NextResponse.json({ message: 'Service unavailable' }, { status: 503 });
  }
}
