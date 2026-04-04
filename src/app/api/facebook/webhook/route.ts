import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/twilio';

export const maxDuration = 60;

const FB_GRAPH = 'https://graph.facebook.com/v19.0';

// ─── Signature verification ───────────────────────────────
function verifySignature(rawBody: string, signature: string, appSecret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Fetch full lead data from FB Graph API ───────────────
async function fetchLeadData(leadgenId: string, pageAccessToken: string) {
  const url = `${FB_GRAPH}/${leadgenId}?access_token=${pageAccessToken}&fields=id,created_time,field_data,ad_id,ad_name,adgroup_id,adgroup_name,form_id,form_name,page_id`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FB Graph API error: ${err}`);
  }
  return res.json();
}

// ─── Parse field_data into structured object ─────────────
function parseFieldData(fieldData: { name: string; values: string[] }[]) {
  const map: Record<string, string> = {};
  for (const f of fieldData || []) {
    map[f.name] = f.values?.[0] || '';
  }
  return {
    phone: map['phone_number'] || map['phone'] || '',
    name: map['full_name'] || map['name'] || '',
    email: map['email'] || '',
  };
}

/**
 * GET /api/facebook/webhook
 * Facebook one-time verification when setting up the webhook
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN;

  // If env var set: must match. If not set: accept any token (initial setup only)
  const tokenValid = verifyToken ? token === verifyToken : true;

  if (mode === 'subscribe' && tokenValid && challenge) {
    console.log('[fb webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/facebook/webhook
 * Facebook pushes leadgen events here in real-time when a Lead Ad form is submitted.
 *
 * Facebook App setup:
 *   1. Add product: Webhooks
 *   2. Subscribe to Page → leadgen events
 *   3. Callback URL: https://<domain>/api/facebook/webhook
 *   4. Verify token: FB_WEBHOOK_VERIFY_TOKEN (your env var)
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify FB signature
  const signature = request.headers.get('x-hub-signature-256') || '';
  const appSecret = process.env.FB_APP_SECRET || '';
  if (appSecret && !verifySignature(rawBody, signature, appSecret)) {
    console.warn('[fb webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // FB expects 200 fast — process async
  void processLeadEvents(payload);

  return NextResponse.json({ received: true });
}

// ─── Process all lead events in payload ──────────────────
async function processLeadEvents(payload: any) {
  if (payload.object !== 'page') return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;

      const value = change.value;
      const leadgenId = value.leadgen_id;
      const pageId = value.page_id;

      if (!leadgenId || !pageId) continue;

      try {
        await processOneLead(leadgenId, pageId, value);
      } catch (err: any) {
        console.error(`[fb webhook] Failed to process lead ${leadgenId}:`, err.message);
      }
    }
  }
}

async function processOneLead(leadgenId: string, pageId: string, meta: any) {
  // Find client by FB page ID stored in service_configs
  const { data: configRows } = await supabaseAdmin
    .from('service_configs')
    .select('client_id, fb_page_access_token, clients(name)')
    .eq('fb_page_id', pageId);

  const config = Array.isArray(configRows) ? configRows[0] : configRows;

  // Fallback to global page access token
  const pageAccessToken =
    (config as any)?.fb_page_access_token ||
    process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageAccessToken) {
    console.error(`[fb webhook] No page access token for page ${pageId}`);
    return;
  }

  const clientId = (config as any)?.client_id;
  if (!clientId) {
    console.warn(`[fb webhook] No client mapped to FB page ${pageId}`);
    return;
  }

  // Fetch full lead from Graph API
  const leadData = await fetchLeadData(leadgenId, pageAccessToken);
  const { phone, name, email } = parseFieldData(leadData.field_data);

  if (!phone) {
    console.warn(`[fb webhook] Lead ${leadgenId} has no phone number`);
    return;
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  // Deduplicate — skip if already exists
  const { data: existing } = await supabaseAdmin
    .from('fb_leads')
    .select('id')
    .eq('client_id', clientId)
    .eq('fb_lead_id', leadgenId)
    .single();

  if (existing) {
    console.log(`[fb webhook] Lead ${leadgenId} already exists, skipping`);
    return;
  }

  // Insert → triggers Supabase DB Webhook → auto-notify → SMS + Telegram + Sequence
  const { data: newLead, error } = await supabaseAdmin
    .from('fb_leads')
    .insert({
      client_id: clientId,
      lead_source: 'fb_lead_ad',
      fb_lead_id: leadgenId,
      name: name || null,
      phone: normalizedPhone,
      email: email || null,
      ad_name: leadData.ad_name || meta.ad_name || null,
      campaign_name: leadData.adgroup_name || meta.adgroup_name || null,
      status: 'new',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[fb webhook] Insert failed for ${leadgenId}:`, error.message);
    return;
  }

  console.log(`[fb webhook] Lead created: ${newLead?.id} — ${name} (${normalizedPhone})`);
}
