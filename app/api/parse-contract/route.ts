import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractOrderItems, extractLocation } from '@/lib/tableExtractor';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';
import { fetchAndParseAddendums, validateAddendumUrl, AddendumData } from '@/lib/addendumParser';

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
      
      // Extract addendumLinks array (optional)
      const addendumLinks: string[] = body.addendumLinks || [];
      
      // Validate addendum links if provided
      if (addendumLinks.length > 0) {
        const invalidLinks = addendumLinks.filter(link => !validateAddendumUrl(link));
        if (invalidLinks.length > 0) {
          return NextResponse.json(
            { 
              error: 'Invalid addendum URL format',
              message: `The following links are invalid: ${invalidLinks.join(', ')}. Expected format: https://l1.prodbx.com/go/view/?...`
            },
            { status: 400 }
          );
        }
      }
      
      // Parse EML file
      const parsed = await parseEML(fileContent);
      
      // Extract location
      const location = extractLocation(parsed.text);
      
      // Debug: Log extracted location data
      console.log('[API] Extracted location:', JSON.stringify(location, null, 2));
      
      // Extract order items from email
      const items = extractOrderItems(parsed.html);
      
      // Fetch and parse addendums if provided
      let addendumData: AddendumData[] = [];
      if (addendumLinks.length > 0) {
        console.log(`[API] Processing ${addendumLinks.length} addendum link(s)...`);
        // fetchAndParseAddendums handles errors gracefully - continues with other links if one fails
        try {
          addendumData = await fetchAndParseAddendums(addendumLinks);
          console.log(`[API] Successfully processed ${addendumData.length} addendum(s) out of ${addendumLinks.length} link(s)`);
          
          // Log summary of addendum items
          addendumData.forEach((addendum) => {
            console.log(`[API] Addendum #${addendum.addendumNumber}: ${addendum.items.length} items`);
          });
          
          // If no addendums were processed but links were provided, log warning
          if (addendumData.length === 0) {
            console.warn(`[API] Warning: All ${addendumLinks.length} addendum link(s) failed to process`);
          }
        } catch (error) {
          // Only throw if ALL links failed and function throws error
          console.error('[API] Error processing addendums:', error);
          // Continue with email items even if addendums fail
          // Log error but don't fail the entire request
          if (error instanceof Error) {
            console.error('[API] Addendum error details:', error.message);
          }
          // Set addendumData to empty array to continue with email items only
          addendumData = [];
        }
      }
      
      // Generate spreadsheet with applyFormatting option and addendum data
      const spreadsheetBuffer = await generateSpreadsheet(items, location, applyFormatting, addendumData);
      
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

