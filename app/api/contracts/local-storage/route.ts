import { NextRequest, NextResponse } from 'next/server';

/**
 * Client-side helper endpoint to sync localStorage contracts
 * This is a temporary solution until we have proper database storage
 */
export async function GET(request: NextRequest) {
  // This endpoint is just for documentation
  // Actual localStorage operations happen on the client side
  return NextResponse.json({
    message: 'Use LocalStorageStore on the client side for temporary storage',
    note: 'This is a temporary solution until database storage is implemented'
  });
}

