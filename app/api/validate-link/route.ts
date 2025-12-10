import { NextRequest, NextResponse } from 'next/server';
import { validateAddendumUrl, fetchAddendumHTML } from '@/lib/addendumParser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate format
    if (!validateAddendumUrl(url.trim())) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid URL format. Expected format: https://l1.prodbx.com/go/view/?...'
        },
        { status: 200 } // Return 200 with valid: false, not an error status
      );
    }

    // Validate accessibility by attempting to fetch
    try {
      await fetchAddendumHTML(url.trim());
      return NextResponse.json({
        valid: true,
      });
    } catch (error) {
      return NextResponse.json({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to access link',
      }, { status: 200 }); // Return 200 with valid: false
    }
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
