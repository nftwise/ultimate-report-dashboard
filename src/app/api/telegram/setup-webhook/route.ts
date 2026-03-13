import { NextRequest, NextResponse } from 'next/server';

// One-time endpoint to register Telegram webhook from Vercel server
// Protected by CRON_SECRET
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');

  if (!token || !webhookSecret || !baseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook?secret=${webhookSecret}`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();

  return NextResponse.json({ setWebhook: data, webhookInfo: info.result });
}
