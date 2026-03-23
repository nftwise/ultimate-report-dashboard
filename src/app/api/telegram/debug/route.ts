import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Debug endpoint — returns bot response as JSON (no Telegram send)
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const question = request.nextUrl.searchParams.get('q') || 'how many clients?';

  try {
    const start = Date.now();
    const { reply, isDM } = await processMessage(question, '1902460211');
    const ms = Date.now() - start;
    return NextResponse.json({ ok: true, reply, isDM, ms });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack });
  }
}
