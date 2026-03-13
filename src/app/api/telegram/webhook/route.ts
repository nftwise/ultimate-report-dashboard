import { NextRequest } from 'next/server';
import { parseIntent, executeIntent, replyToChat, sendDM } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Validate webhook secret
  const secret = request.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return new Response('OK');
  }

  const message = update?.message;
  if (!message?.text) return new Response('OK');

  const chatId: number = message.chat?.id;
  const senderId: string = String(message.from?.id || '');
  const text: string = message.text || '';

  // 2. Check if bot is mentioned in group chat
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
  if (botUsername && !text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {
    return new Response('OK');
  }

  // 3. Whitelist check — silently ignore unknown senders
  const allowed = (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(senderId)) {
    return new Response('OK');
  }

  // 4. Strip bot @mention
  const cleanText = text.replace(/@\w+/g, '').trim();
  if (!cleanText) return new Response('OK');

  try {
    const intent = await parseIntent(cleanText);

    // Password intent → send link via DM, acknowledge in group
    if (intent.intent === 'get_password') {
      const response = await executeIntent(intent, senderId);
      // Acknowledge in group (no sensitive info)
      await replyToChat(chatId, `🔒 Sending credentials link to your DM...`);
      // Send actual link via DM
      await sendDM(senderId, response);
    } else {
      const response = await executeIntent(intent, senderId);
      await replyToChat(chatId, response);
    }
  } catch (err) {
    console.error('[TelegramBot] Error:', err);
    await replyToChat(chatId, '⚠️ Something went wrong. Check server logs.');
  }

  return new Response('OK');
}
