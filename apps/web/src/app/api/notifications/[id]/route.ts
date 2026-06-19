import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3013';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const response = await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: response.status });
    }

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}