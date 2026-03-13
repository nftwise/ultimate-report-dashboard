import { NextRequest } from 'next/server';
import { processMessage, replyToChat, sendDM } from '@/lib/telegram-bot';

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

  // 2. In group chats: require @mention. In DMs: always process.
  const chatType = message.chat?.type;
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
  if (isGroup && botUsername && !text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {
    return new Response('OK');
  }

  // 3. Whitelist check — silently ignore unknown senders
  const allowed = (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(senderId)) {
    return new Response('OK');
  }

  // 4. Strip bot @mention from text
  const cleanText = text.replace(/@\w+/g, '').trim();
  if (!cleanText) return new Response('OK');

  // 5. Process message
  try {
    const { reply, isDM } = await processMessage(cleanText, senderId);

    if (isDM) {
      // Password → acknowledge in group, send link via DM
      await replyToChat(chatId, '🔒 Sending credentials link to your DM...');
      await sendDM(senderId, reply);
    } else {
      await replyToChat(chatId, reply);
    }
  } catch (err) {
    console.error('[TelegramBot] Error:', err);
    await replyToChat(chatId, '⚠️ Something went wrong. Try again.');
  }

  return new Response('OK');
}
