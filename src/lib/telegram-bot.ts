/**
 * Telegram Q&A Bot — Intent parsing + DB query logic
 * Used by /api/telegram/webhook to answer admin/team questions in group chat.
 *
 * Password security: one-time link requiring dashboard login (2-factor effectively)
 * Bot credentials: AES-256-GCM encrypted in bot_credentials table
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

const TELEGRAM_API = 'https://api.telegram.org';

// ─── AES-256-GCM helpers ──────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (hex.length !== 64) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

export function encryptPassword(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(data: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IntentName =
  | 'get_password'
  | 'client_exists'
  | 'count_clients'
  | 'client_info'
  | 'list_clients'
  | 'last_sync'
  | 'get_fee'
  | 'get_contract'
  | 'get_notes'
  | 'list_overdue'
  | 'unknown';

interface BotIntent {
  intent: IntentName;
  client_name: string | null;
}

// ─── Claude Haiku intent parser ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a command parser for an internal marketing dashboard bot.
Extract the intent and client name from the user message.
Return ONLY valid JSON — no prose, no markdown, no explanation.

Schema: {"intent": string, "client_name": string | null}

Valid intents:
- "get_password"  : credentials/login/pass/password for a client
- "client_exists" : is X our client? do we work with X?
- "count_clients" : how many clients, total clients
- "client_info"   : info/details/about/who is X, address, website, phone
- "list_clients"  : list all clients, show clients
- "last_sync"     : last sync/update for X
- "get_fee"       : fee/price/cost/how much for X, monthly payment
- "get_contract"  : contract/start date/end date/renewal for X
- "get_notes"     : notes/status/info about X
- "list_overdue"  : overdue/unpaid/late clients
- "unknown"       : cannot determine intent

Examples:
"what's the pass for dr ron?" → {"intent":"get_password","client_name":"dr ron"}
"is healing hands our client?" → {"intent":"client_exists","client_name":"healing hands"}
"how many clients?" → {"intent":"count_clients","client_name":null}
"tell me about coreposture" → {"intent":"client_info","client_name":"coreposture"}
"list all clients" → {"intent":"list_clients","client_name":null}
"when did dr digrado last sync?" → {"intent":"last_sync","client_name":"dr digrado"}
"how much does dr ron pay?" → {"intent":"get_fee","client_name":"dr ron"}
"when does healing hands contract end?" → {"intent":"get_contract","client_name":"healing hands"}
"any notes on coreposture?" → {"intent":"get_notes","client_name":"coreposture"}
"who is overdue?" → {"intent":"list_overdue","client_name":null}`;

export async function parseIntent(text: string): Promise<BotIntent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[TelegramBot] ANTHROPIC_API_KEY not set');
    return { intent: 'unknown', client_name: null };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    return JSON.parse(raw) as BotIntent;
  } catch (err) {
    console.error('[TelegramBot] parseIntent error:', err);
    return { intent: 'unknown', client_name: null };
  }
}

// ─── Client resolver (fuzzy name match) ──────────────────────────────────────

async function resolveClient(name: string): Promise<{ id: string; name: string; slug: string } | null> {
  if (!name) return null;

  const { data: full } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug')
    .ilike('name', `%${name}%`)
    .eq('is_active', true)
    .limit(3);
  if (full?.length) return full[0];

  const words = name.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of words) {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')
      .ilike('name', `%${word}%`)
      .eq('is_active', true)
      .limit(3);
    if (data?.length) return data[0];
  }
  return null;
}

// ─── One-time reveal token ────────────────────────────────────────────────────

async function createRevealToken(clientId: string, requestedByTelegramId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const { data, error } = await supabaseAdmin
    .from('password_reveal_tokens')
    .insert({
      client_id: clientId,
      expires_at: expiresAt.toISOString(),
      requested_by_telegram_id: requestedByTelegramId,
    })
    .select('token')
    .single();

  if (error || !data) throw new Error('Failed to create reveal token');

  const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  return `${baseUrl}/reveal?token=${data.token}`;
}

// ─── Intent execution ─────────────────────────────────────────────────────────

export async function executeIntent(intent: BotIntent, telegramUserId: string): Promise<string> {
  const { intent: name, client_name } = intent;

  // ── get_password ───────────────────────────────────────────────────────────
  if (name === 'get_password') {
    if (!client_name) return '❓ Which client? e.g. "password for dr ron"';

    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data: creds } = await supabaseAdmin
      .from('bot_credentials')
      .select('id')
      .eq('client_id', client.id)
      .limit(1);

    if (!creds?.length) {
      return `⚠️ <b>${client.name}</b> — no credentials stored yet.\nAdd them in Edit Client → Credentials.`;
    }

    try {
      const link = await createRevealToken(client.id, telegramUserId);
      return [
        `🔐 <b>${client.name}</b> — credentials ready.`,
        ``,
        `👉 ${link}`,
        ``,
        `⏱ Link expires in <b>5 minutes</b> (single use).`,
        `Dashboard login required to view.`,
      ].join('\n');
    } catch {
      return '⚠️ Failed to generate secure link. Try again.';
    }
  }

  // ── client_exists ──────────────────────────────────────────────────────────
  if (name === 'client_exists') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;
    return `✅ Yes — <b>${client.name}</b> is an active client.\nSlug: <code>${client.slug}</code>`;
  }

  // ── count_clients ──────────────────────────────────────────────────────────
  if (name === 'count_clients') {
    const { count } = await supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    return `📊 <b>${count ?? 0} active clients</b>`;
  }

  // ── client_info ────────────────────────────────────────────────────────────
  if (name === 'client_info') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, slug, owner, contact_email, contact_phone, city, full_address, website, has_seo, has_ads, monthly_fee, payment_status')
      .eq('id', client.id)
      .single();

    if (!data) return `❌ Could not fetch info for <b>${client.name}</b>`;

    const services = [data.has_seo && 'SEO', data.has_ads && 'Ads'].filter(Boolean).join(' + ') || 'None';
    const statusEmoji = data.payment_status === 'overdue' ? '🔴' : data.payment_status === 'paused' ? '🟡' : '🟢';

    return [
      `ℹ️ <b>${data.name}</b> ${statusEmoji}`,
      data.city || data.full_address ? `📍 ${data.full_address || data.city}` : '',
      data.website ? `🌐 ${data.website}` : '',
      data.owner ? `👤 Owner: ${data.owner}` : '',
      data.contact_email ? `📧 ${data.contact_email}` : '',
      data.contact_phone ? `📞 ${data.contact_phone}` : '',
      `🛠 Services: ${services}`,
      data.monthly_fee ? `💰 $${data.monthly_fee}/mo` : '',
    ].filter(Boolean).join('\n');
  }

  // ── list_clients ───────────────────────────────────────────────────────────
  if (name === 'list_clients') {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, has_seo, has_ads')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!data?.length) return '📋 No active clients found.';

    const lines = data.map((c: any, i: number) => {
      const s = [c.has_seo && 'SEO', c.has_ads && 'Ads'].filter(Boolean).join('+') || '—';
      return `${i + 1}. ${c.name} <i>(${s})</i>`;
    });
    return `📋 <b>${data.length} active clients:</b>\n\n${lines.join('\n')}`;
  }

  // ── last_sync ──────────────────────────────────────────────────────────────
  if (name === 'last_sync') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .eq('client_id', client.id)
      .eq('period_type', 'daily')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!data?.date) return `⚠️ <b>${client.name}</b> — no data found.`;

    const daysAgo = Math.floor((Date.now() - new Date(data.date + 'T12:00:00').getTime()) / 86400000);
    const label = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
    return `🕐 <b>${client.name}</b> last synced: <b>${data.date}</b> (${label})`;
  }

  // ── get_fee ────────────────────────────────────────────────────────────────
  if (name === 'get_fee') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, monthly_fee, has_seo, has_ads')
      .eq('id', client.id)
      .single();

    if (!data?.monthly_fee) return `⚠️ <b>${client.name}</b> — no fee recorded yet.`;

    const services = [data.has_seo && 'SEO', data.has_ads && 'Ads'].filter(Boolean).join(' + ');
    return `💰 <b>${data.name}</b>\n$${data.monthly_fee}/month (${services || 'services not specified'})`;
  }

  // ── get_contract ───────────────────────────────────────────────────────────
  if (name === 'get_contract') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, contract_start, contract_end, payment_status')
      .eq('id', client.id)
      .single();

    if (!data) return `❌ Could not fetch contract for <b>${client.name}</b>`;

    const statusEmoji = data.payment_status === 'overdue' ? '🔴' : data.payment_status === 'paused' ? '🟡' : '🟢';
    const lines = [
      `📄 <b>${data.name}</b> ${statusEmoji}`,
      data.contract_start ? `Start: ${data.contract_start}` : 'Start: not set',
      data.contract_end ? `End: ${data.contract_end}` : 'End: not set',
      `Status: ${data.payment_status || 'active'}`,
    ];

    if (data.contract_end) {
      const daysLeft = Math.floor((new Date(data.contract_end).getTime() - Date.now()) / 86400000);
      if (daysLeft >= 0) lines.push(`⏳ ${daysLeft} days remaining`);
      else lines.push(`⚠️ Expired ${Math.abs(daysLeft)} days ago`);
    }

    return lines.join('\n');
  }

  // ── get_notes ──────────────────────────────────────────────────────────────
  if (name === 'get_notes') {
    if (!client_name) return '❓ Which client?';
    const client = await resolveClient(client_name);
    if (!client) return `❌ No active client found matching "<b>${client_name}</b>"`;

    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, internal_notes')
      .eq('id', client.id)
      .single();

    if (!data?.internal_notes) return `📝 <b>${client.name}</b> — no notes recorded.`;
    return `📝 <b>${client.name}</b>\n\n${data.internal_notes}`;
  }

  // ── list_overdue ───────────────────────────────────────────────────────────
  if (name === 'list_overdue') {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('name, monthly_fee, contract_end')
      .eq('is_active', true)
      .eq('payment_status', 'overdue')
      .order('name', { ascending: true });

    if (!data?.length) return '✅ No overdue clients.';

    const lines = data.map((c: any) =>
      `🔴 ${c.name}${c.monthly_fee ? ` — $${c.monthly_fee}/mo` : ''}`
    );
    return `🔴 <b>${data.length} overdue client(s):</b>\n\n${lines.join('\n')}`;
  }

  // ── unknown ────────────────────────────────────────────────────────────────
  return [
    `🤖 <b>What can I help with?</b>`,
    ``,
    `• "password for [client]"`,
    `• "is [client] our client?"`,
    `• "how many clients?"`,
    `• "list all clients"`,
    `• "info on [client]"`,
    `• "fee for [client]"`,
    `• "contract for [client]"`,
    `• "notes on [client]"`,
    `• "last sync for [client]"`,
    `• "who is overdue?"`,
  ].join('\n');
}

// ─── Reply helpers ────────────────────────────────────────────────────────────

export async function replyToChat(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[TelegramBot] replyToChat error:', err);
  }
}

export async function sendDM(telegramUserId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramUserId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[TelegramBot] sendDM error:', err);
  }
}
