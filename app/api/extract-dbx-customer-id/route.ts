import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractLocation } from '@/lib/tableExtractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file } = body; // base64 encoded EML file

    if (!file || typeof file !== 'string') {
      return NextResponse.json(
        { error: 'EML file content is required' },
        { status: 400 }
      );
    }

    // Parse EML file
    const buffer = Buffer.from(file, 'base64');
    const parsed = await parseEML(buffer);
    const text = parsed.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({
        dbxCustomerId: null,
      });
    }

    // Extract location (includes dbxCustomerId)
    const location = extractLocation(text);

    return NextResponse.json({
      dbxCustomerId: location.dbxCustomerId || null,
    });
  } catch (error) {
    console.error('[Extract DBX Customer ID] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        dbxCustomerId: null,
      },
      { status: 500 }
    );
  }
}
