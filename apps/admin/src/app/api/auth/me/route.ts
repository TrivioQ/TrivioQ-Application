import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@trivioq/database';

const prisma = new PrismaClient();

/**
 * Internal-only Route Handler — called exclusively by the middleware.
 * Reads the session cookie, looks up the user in the DB, and returns their role.
 * NOT a public endpoint — the middleware should never call this for external requests.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('firebase-token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'No session cookie' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: token },
      select: { role: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({ role: user.role, email: user.email }, { status: 200 });
  } catch (error) {
    console.error('[/api/auth/me] DB lookup failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
