import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.GOOGLE_SHEETS_SERVICE_KEY;
  if (!raw) return NextResponse.json({ status: 'missing' });

  return NextResponse.json({
    length: raw.length,
    first10: raw.substring(0, 10),
    last10: raw.substring(raw.length - 10),
    startsWithBrace: raw.trim().startsWith('{'),
    endsWithBrace: raw.trim().endsWith('}'),
    parseError: (() => { try { JSON.parse(raw.trim()); return null; } catch(e: any) { return e.message; } })(),
  });
}
