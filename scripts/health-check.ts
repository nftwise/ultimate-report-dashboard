/**
 * Health check — runs after all sync groups complete (~12:30 UTC).
 * Alerts Telegram if any client is missing data for yesterday.
 */
import { supabaseAdmin } from '../src/lib/supabase';
import { sendTelegramMessage } from '../src/lib/telegram';

function caDate(daysAgo: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const yesterday = caDate(1);
  const gscDate   = caDate(3);

  const [clientsRes, gbpLocationsRes] = await Promise.all([
    supabaseAdmin.from('clients').select('id, name, has_seo, has_ads, sync_group').eq('is_active', true),
    supabaseAdmin.from('gbp_locations').select('client_id').eq('is_active', true),
  ]);

  const clients = clientsRes.data;
  if (!clients?.length) {
    console.log('[health-check] No active clients');
    return;
  }

  // Only flag GBP issues for clients that have a location configured
  const gbpConfigured = new Set((gbpLocationsRes.data || []).map((r: any) => r.client_id));

  const [ga4Rows, adsRows, gbpRows, gscRows] = await Promise.all([
    supabaseAdmin.from('ga4_sessions').select('client_id').eq('date', yesterday),
    supabaseAdmin.from('ads_campaign_metrics').select('client_id').eq('date', yesterday),
    supabaseAdmin.from('gbp_location_daily_metrics').select('client_id, fetch_status').eq('date', yesterday),
    supabaseAdmin.from('gsc_daily_summary').select('client_id').eq('date', gscDate),
  ]);

  const ga4Have    = new Set((ga4Rows.data || []).map((r: any) => r.client_id));
  const adsHave    = new Set((adsRows.data || []).map((r: any) => r.client_id));
  const gbpOK      = new Set((gbpRows.data || []).filter((r: any) => r.fetch_status !== 'error').map((r: any) => r.client_id));
  const gbpErr     = new Set((gbpRows.data || []).filter((r: any) => r.fetch_status === 'error').map((r: any) => r.client_id));
  const gscHave    = new Set((gscRows.data || []).map((r: any) => r.client_id));

  const missing: string[] = [];

  for (const c of clients) {
    const issues: string[] = [];
    if (c.has_seo && !ga4Have.has(c.id)) issues.push('GA4');
    if (c.has_ads && !adsHave.has(c.id)) issues.push('Ads');
    if (gbpConfigured.has(c.id) && !gbpOK.has(c.id)) issues.push(gbpErr.has(c.id) ? 'GBP(error)' : 'GBP(missing)');
    if (c.has_seo && !gscHave.has(c.id)) issues.push(`GSC(${gscDate})`);
    if (issues.length > 0) missing.push(`<b>${c.name}</b> [${c.sync_group}]: ${issues.join(', ')}`);
  }

  const ok = clients.length - missing.length;
  console.log(`[health-check] ${yesterday}: ${ok}/${clients.length} OK, ${missing.length} issues`);

  if (missing.length > 0) {
    await sendTelegramMessage(
      `🔍 <b>Health Check — ${yesterday}</b>\n` +
      `✅ OK: ${ok}/${clients.length} clients\n` +
      `❌ Issues: ${missing.length}\n\n` +
      missing.join('\n')
    );
    // Exit 1 so GitHub Actions marks the step as failed (visible in Actions UI)
    process.exit(1);
  } else {
    await sendTelegramMessage(`✅ <b>Health Check — ${yesterday}</b>\nAll ${clients.length} clients synced OK`);
  }
}

main().catch(async err => {
  console.error('[health-check] Fatal:', err.message);
  await sendTelegramMessage(`🔴 <b>Health Check CRASHED</b>\n${err.message}`).catch(() => {});
  process.exit(1);
});
