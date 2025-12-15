import { NextRequest, NextResponse } from 'next/server';
import { validateAddendumUrl, fetchAddendumHTML, extractAddendumNumber } from '@/lib/addendumParser';
import { load } from 'cheerio';

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

    // Validate accessibility by attempting to fetch and extract addendum number
    try {
      const html = await fetchAddendumHTML(url.trim());
      
      // Try to extract addendum number from page text
      let addendumNumber: string | undefined = undefined;
      try {
        const $ = load(html);
        const pageText = $.text();
        const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
        if (addendumMatch && addendumMatch[1]) {
          addendumNumber = addendumMatch[1].trim();
        } else {
          // Fallback to URL extraction
          addendumNumber = extractAddendumNumber(url.trim());
        }
      } catch (parseError) {
        // Fallback to URL extraction if page parsing fails
        try {
          addendumNumber = extractAddendumNumber(url.trim());
        } catch (urlError) {
          // If both fail, leave as undefined
        }
      }
      
      return NextResponse.json({
        valid: true,
        addendumNumber: addendumNumber,
      });
    } catch (error) {
      // Even if fetch fails, try to extract from URL as fallback
      let addendumNumber: string | undefined = undefined;
      try {
        addendumNumber = extractAddendumNumber(url.trim());
      } catch (urlError) {
        // If extraction fails, leave as undefined
      }
      
      return NextResponse.json({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to access link',
        addendumNumber: addendumNumber, // Still return URL-based number if available
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
