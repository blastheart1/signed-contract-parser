import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Get database name and user
    const result = await sql`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as version;
    `;
    
    // Check if alert_acknowledgments table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alert_acknowledgments'
      ) as table_exists;
    `;

    // Get POSTGRES_URL (masked for security)
    const postgresUrl = process.env.POSTGRES_URL || 'Not set';
    const maskedUrl = postgresUrl.includes('@') 
      ? postgresUrl.split('@')[0].split('//')[0] + '//***@' + postgresUrl.split('@')[1]
      : 'Not available';

    return NextResponse.json({
      success: true,
      database: result.rows[0],
      tableExists: tableCheck.rows[0]?.table_exists || false,
      postgresUrl: maskedUrl,
      connectionInfo: {
        hasUrl: !!process.env.POSTGRES_URL,
        urlLength: postgresUrl.length,
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      postgresUrl: process.env.POSTGRES_URL ? 'Set (masked)' : 'Not set',
    }, { status: 500 });
  }
}
