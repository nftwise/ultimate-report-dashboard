import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS, toE164US } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/webhooks/gravity-forms?client=<slug>
 *
 * Called by the Gravity Forms "Webhooks" add-on on each client's WordPress
 * site whenever a form is submitted. Sends a NEW-LEAD ALERT SMS to:
 *   1. the clinic's SMS-capable mobile (clients.notify_phone) — NEVER the
 *      office landline (contact_phone/phone are landlines, not SMS-capable)
 *   2. a global admin monitor number (LEAD_ALERT_ADMIN_PHONE) for parallel QA
 *
 * Required env vars:
 *   GF_WEBHOOK_SECRET     — shared secret; GF must send it as `x-webhook-secret`.
 *                           If unset (local dev), the auth check is skipped.
 *   LEAD_ALERT_ADMIN_PHONE — admin monitor number in E.164 (e.g. +15551234567).
 *                            If unset, the admin send is skipped (logged).
 * (SMS transport env: AWS_ACCESS_KEY_ID/.. or TWILIO_* — see src/lib/twilio.ts)
 *
 * Behavior: never 500s on a downstream SMS failure — always returns 200 with
 * a breakdown so Gravity Forms doesn't retry-storm.
 */

// Common GF field-key aliases (case-insensitive). GF Webhooks can post the
// field-label-derived keys or raw input_N keys, so we scan a generous list.
const NAME_KEYS = ['name', 'full_name', 'fullname', 'your-name', 'your_name', 'first_name', 'firstname', 'lead_name'];
const PHONE_KEYS = ['phone', 'tel', 'telephone', 'phone_number', 'mobile', 'cell', 'your-phone', 'your_phone'];
const EMAIL_KEYS = ['email', 'email_address', 'your-email', 'your_email', 'e-mail'];
const MESSAGE_KEYS = ['message', 'comments', 'comment', 'notes', 'note', 'how_can_we_help', 'how-can-we-help', 'how_can_we_help_you', 'your-message', 'your_message', 'details', 'inquiry'];

function pick(obj: Record<string, any>, keys: string[]): string {
  if (!obj) return '';
  // Build a lowercased-key lookup once.
  const lc: Record<string, any> = {};
  for (const k of Object.keys(obj)) lc[k.toLowerCase()] = obj[k];
  for (const key of keys) {
    const v = lc[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

/** Parse GF payload whether it arrives as JSON or form-encoded. */
async function parsePayload(request: NextRequest): Promise<Record<string, any>> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      return (await request.json()) || {};
    }
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      const obj: Record<string, any> = {};
      for (const [k, v] of form.entries()) obj[k] = typeof v === 'string' ? v : '';
      return obj;
    }
    // Unknown content-type: try JSON first, then form-encoded text.
    const text = await request.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      const obj: Record<string, any> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth (skip gracefully in dev if secret unset) ──────────────────
    const secret = request.headers.get('x-webhook-secret');
    if (process.env.GF_WEBHOOK_SECRET && secret !== process.env.GF_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Identify client by slug ────────────────────────────────────────
    const slug = request.nextUrl.searchParams.get('client');
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: 'Missing ?client=<slug>' },
        { status: 400 }
      );
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug, notify_phone')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!client) {
      return NextResponse.json(
        { ok: false, error: `No active client for slug "${slug}"` },
        { status: 404 }
      );
    }

    // ── 3. Parse + extract lead fields (defensive) ────────────────────────
    const payload = await parsePayload(request);
    const leadName = pick(payload, NAME_KEYS) || 'Unknown';
    const rawLeadPhone = pick(payload, PHONE_KEYS);
    const leadPhone = toE164US(rawLeadPhone) || rawLeadPhone || '';
    const leadEmail = pick(payload, EMAIL_KEYS);
    const leadMessage = pick(payload, MESSAGE_KEYS);

    // ── 4. Build alert SMS (under 320 chars) ──────────────────────────────
    let alert = `New lead — ${client.name}: ${leadName}, ${leadPhone || 'no phone'}`;
    if (leadMessage) alert += `, "${leadMessage}"`;
    if (alert.length > 320) alert = alert.slice(0, 317) + '...';

    // ── 5. Record lead (best-effort) ──────────────────────────────────────
    void supabaseAdmin
      .from('website_form_leads')
      .insert({
        client_id: client.id,
        name: leadName,
        phone: leadPhone,
        email: leadEmail || null,
        message: leadMessage || null,
        raw: payload,
      })
      .then(({ error }) => {
        if (error) console.warn('[gravity-forms] lead insert failed:', error.message);
      });

    // ── 6. Dual send ──────────────────────────────────────────────────────
    const sentTo: string[] = [];
    const skipped: { recipient: string; reason: string }[] = [];

    // (a) Clinic SMS-capable mobile — NEVER fall back to landline.
    const clinicMobile = toE164US(client.notify_phone);
    if (clinicMobile) {
      try {
        await sendSMS(clinicMobile, alert);
        sentTo.push(clinicMobile);
      } catch (err: any) {
        console.error(`[gravity-forms] clinic SMS failed (${clinicMobile}):`, err.message);
        skipped.push({ recipient: clinicMobile, reason: `send failed: ${err.message}` });
      }
    } else {
      const reason = client.notify_phone
        ? `invalid notify_phone "${client.notify_phone}"`
        : 'notify_phone not set';
      console.warn(`[gravity-forms] ${client.name}: skipping clinic alert — ${reason} (not falling back to landline)`);
      skipped.push({ recipient: 'clinic', reason });
    }

    // (b) Global admin monitor number.
    const adminPhone = toE164US(process.env.LEAD_ALERT_ADMIN_PHONE);
    if (adminPhone) {
      try {
        await sendSMS(adminPhone, alert);
        sentTo.push(adminPhone);
      } catch (err: any) {
        console.error(`[gravity-forms] admin SMS failed (${adminPhone}):`, err.message);
        skipped.push({ recipient: adminPhone, reason: `send failed: ${err.message}` });
      }
    } else {
      skipped.push({ recipient: 'admin', reason: 'LEAD_ALERT_ADMIN_PHONE not set or invalid' });
    }

    // ── 7. Telegram team alert (non-blocking) ─────────────────────────────
    await sendTelegramMessage(
      `🌐 <b>New Website Lead — ${client.name}</b>\n\n` +
      `👤 Name: ${leadName}\n` +
      `📞 Phone: ${leadPhone || '—'}\n` +
      (leadEmail ? `📧 Email: ${leadEmail}\n` : '') +
      (leadMessage ? `💬 Message: ${leadMessage}\n` : '') +
      `📲 SMS sent: ${sentTo.length ? sentTo.join(', ') : 'none'}`
    ).catch(() => {});

    console.log(`[gravity-forms] ${client.name}: lead "${leadName}" — sent ${sentTo.length}, skipped ${skipped.length}`);

    // Always 200 so GF doesn't retry-storm on downstream SMS failures.
    return NextResponse.json({ ok: true, client: client.slug, sentTo, skipped });
  } catch (error: any) {
    // Even on unexpected errors, return 200 with detail to avoid GF retry storms.
    console.error('[gravity-forms] exception:', error);
    return NextResponse.json({ ok: false, error: error.message, sentTo: [], skipped: [] });
  }
}
