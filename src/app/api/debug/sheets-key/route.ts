import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL ? `✅ ${process.env.GOOGLE_CLIENT_EMAIL.substring(0, 30)}...` : '❌ missing',
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? `✅ len=${process.env.GOOGLE_PRIVATE_KEY.length}` : '❌ missing',
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID ? `✅ ${process.env.GOOGLE_PROJECT_ID}` : '❌ missing',
    GOOGLE_SHEETS_SERVICE_KEY: process.env.GOOGLE_SHEETS_SERVICE_KEY
      ? `present len=${process.env.GOOGLE_SHEETS_SERVICE_KEY.length} starts=${process.env.GOOGLE_SHEETS_SERVICE_KEY.substring(0,5)}`
      : '❌ missing',
  });
}
