import { NextRequest, NextResponse } from 'next/server';
import { syncAndRespond } from '../login/route';

// ---------------------------------------------------------------------------
// POST /api/auth/sync
//
// Legacy route kept for backward compatibility.
// Accepts { idToken } and delegates to the shared syncAndRespond helper,
// which calls the backend and sets the tq_auth httpOnly cookie.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  let idToken: string | undefined;

  try {
    const body = await req.json();
    idToken = body?.idToken;
  } catch {
    // fall through
  }

  if (!idToken) {
    return NextResponse.json({ message: 'Missing idToken in request body' }, { status: 401 });
  }

  return syncAndRespond(idToken);
}
