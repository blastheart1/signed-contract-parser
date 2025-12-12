import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getLatestChangelog } from '@/lib/changelog';

/**
 * API endpoint to get current app version and latest changelog entry
 * GET /api/version
 */
export async function GET() {
  try {
    // Read package.json to get version
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version || '1.0.0';
    const latestChangelog = getLatestChangelog();

    return NextResponse.json({
      success: true,
      version: currentVersion,
      latestChangelog,
    });
  } catch (error) {
    console.error('Error fetching version info:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch version information',
        version: '1.0.0',
        latestChangelog: null,
      },
      { status: 500 }
    );
  }
}
