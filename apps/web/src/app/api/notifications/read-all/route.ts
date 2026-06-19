import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3013';

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to mark all as read' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error marking all as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}