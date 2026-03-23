import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function setup() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');

  if (!token || !secret || !baseUrl) {
    console.error('Missing: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, or NEXTAUTH_URL');
    process.exit(1);
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook?secret=${secret}`;
  console.log('Registering webhook:', webhookUrl);

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
  console.log('setWebhook:', JSON.stringify(data, null, 2));

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log('Webhook info:', JSON.stringify(info.result, null, 2));
}

setup().catch(console.error);
