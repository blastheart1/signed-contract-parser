import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

