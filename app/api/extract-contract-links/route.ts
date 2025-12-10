import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractContractLinks } from '@/lib/contractLinkExtractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file } = body;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Parse EML file
    const fileContent = Buffer.from(file, 'base64');
    const parsed = await parseEML(fileContent);

    // Extract links using existing function
    const extractedLinks = extractContractLinks(parsed);

    return NextResponse.json({
      success: true,
      links: {
        originalContractUrl: extractedLinks.originalContractUrl,
        addendumUrls: extractedLinks.addendumUrls,
      },
    });
  } catch (error) {
    console.error('Error extracting contract links:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
