import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractOrderItems, extractLocation } from '@/lib/tableExtractor';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let fileContent: Buffer;
    
    if (contentType.includes('application/json')) {
      // JSON with base64 encoded file
      const body = await request.json();
      
      if (body && body.file) {
        fileContent = Buffer.from(body.file, 'base64');
      } else if (body && body.data) {
        fileContent = Buffer.from(body.data, 'base64');
      } else {
        return NextResponse.json(
          { error: 'No file data in request. Expected "file" or "data" field with base64 content.' },
          { status: 400 }
        );
      }
      
      if (!fileContent || fileContent.length === 0) {
        return NextResponse.json(
          { error: 'No file uploaded or file is empty' },
          { status: 400 }
        );
      }
      
      // Extract applyFormatting option (default: false)
      const applyFormatting = body.applyFormatting === true;
      
      // Parse EML file
      const parsed = await parseEML(fileContent);
      
      // Extract location
      const location = extractLocation(parsed.text);
      
      // Debug: Log extracted location data
      console.log('[API] Extracted location:', JSON.stringify(location, null, 2));
      
      // Extract order items
      const items = extractOrderItems(parsed.html);
      
      // Generate spreadsheet with applyFormatting option
      const spreadsheetBuffer = await generateSpreadsheet(items, location, applyFormatting);
      
      // Generate filename based on location data
      // Format: "{Client Initial Last Name} - #{DBX Customer ID} - {Address}.xlsx"
      const filename = generateSpreadsheetFilename(location);
      
      // Debug: Log generated filename
      console.log('[API] Generated filename:', filename);
      
      // Encode filename for Content-Disposition header (RFC 5987)
      // Use both filename (fallback) and filename* (UTF-8 encoded) for maximum browser compatibility
      const encodedFilename = encodeURIComponent(filename);
      const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
      
      // Return file as response (Buffer works directly with NextResponse in newer versions)
      return new NextResponse(spreadsheetBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': contentDisposition,
          'Content-Length': spreadsheetBuffer.length.toString(),
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Please send JSON with base64 encoded file.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process contract',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

