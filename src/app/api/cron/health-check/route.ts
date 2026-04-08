import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 60;

/**
 * GET /api/cron/health-check
 * Runs after all sync groups complete (~12:30 UTC).
 * Checks for missing/errored data and alerts Telegram.
 * Also triggers refetch for any missing clients (fire-and-forget).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // GA4/Ads/GBP: check yesterday. GSC: check 3 days ago (its fetch lag)
  const now = new Date();
  const ca = (daysAgo: number) => {
    const d = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const yesterday = ca(1);
  const gscDate   = ca(3);

  // Get all active clients
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, has_seo, has_ads, sync_group')
    .eq('is_active', true);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, message: 'No active clients' });
  }

  // ── GA4: check ga4_sessions rows exist for yesterday ──
  const { data: ga4Rows } = await supabaseAdmin
    .from('ga4_sessions')
    .select('client_id')
    .eq('date', yesterday);
  const ga4Have = new Set((ga4Rows || []).map((r: any) => r.client_id));

  // ── Ads: check ads_campaign_metrics rows exist for yesterday ──
  const { data: adsRows } = await supabaseAdmin
    .from('ads_campaign_metrics')
    .select('client_id')
    .eq('date', yesterday);
  const adsHave = new Set((adsRows || []).map((r: any) => r.client_id));

  // ── GBP: check rows with fetch_status = 'success' for yesterday ──
  const { data: gbpRows } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('client_id, fetch_status')
    .eq('date', yesterday);
  const gbpSuccess = new Set(
    (gbpRows || []).filter((r: any) => r.fetch_status !== 'error').map((r: any) => r.client_id)
  );
  const gbpError = new Set(
    (gbpRows || []).filter((r: any) => r.fetch_status === 'error').map((r: any) => r.client_id)
  );

  // ── GSC: check gsc_daily_summary rows for gscDate ──
  const { data: gscRows } = await supabaseAdmin
    .from('gsc_daily_summary')
    .select('client_id')
    .eq('date', gscDate);
  const gscHave = new Set((gscRows || []).map((r: any) => r.client_id));

  // ── Build missing report ──
  const missing: string[] = [];
  const refetchNeeded: { clientId: string; group: string; sources: string[] }[] = [];

  for (const c of clients) {
    const issues: string[] = [];

    if (c.has_seo && !ga4Have.has(c.id))  issues.push('GA4');
    if (c.has_ads && !adsHave.has(c.id))  issues.push('Ads');
    if (!gbpSuccess.has(c.id)) {
      issues.push(gbpError.has(c.id) ? 'GBP(error)' : 'GBP(missing)');
    }
    if (c.has_seo && !gscHave.has(c.id))  issues.push(`GSC(${gscDate})`);

    if (issues.length > 0) {
      missing.push(`<b>${c.name}</b> [${c.sync_group}]: ${issues.join(', ')}`);
      refetchNeeded.push({ clientId: c.id, group: c.sync_group, sources: issues });
    }
  }

  const ok = clients.length - refetchNeeded.length;
  console.log(`[health-check] ${yesterday}: ${ok}/${clients.length} OK, ${refetchNeeded.length} issues`);

  // ── Send Telegram alert ──
  if (refetchNeeded.length > 0) {
    const lines = missing.join('\n');
    const message =
      `🔍 <b>Health Check — ${yesterday}</b>\n` +
      `✅ OK: ${ok}/${clients.length} clients\n` +
      `❌ Issues: ${refetchNeeded.length}\n\n` +
      lines + '\n\n' +
      `🔄 Triggering refetch...`;
    await sendTelegramMessage(message);

    // ── Trigger refetch (fire-and-forget) ──
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'https://ultimate-report-dashboard.vercel.app';
    const headers = { 'Authorization': `Bearer ${cronSecret || ''}` };

    for (const { clientId, sources } of refetchNeeded) {
      const refetches: Promise<any>[] = [];

      if (sources.some(s => s === 'GA4')) {
        refetches.push(fetch(`${baseUrl}/api/cron/sync-ga4?clientId=${clientId}&date=${yesterday}`, { headers }).catch(() => {}));
      }
      if (sources.some(s => s === 'Ads')) {
        refetches.push(fetch(`${baseUrl}/api/cron/sync-ads?clientId=${clientId}&date=${yesterday}`, { headers }).catch(() => {}));
      }
      if (sources.some(s => s.startsWith('GBP'))) {
        refetches.push(fetch(`${baseUrl}/api/cron/sync-gbp?clientId=${clientId}&date=${yesterday}`, { headers }).catch(() => {}));
      }
      if (sources.some(s => s.startsWith('GSC'))) {
        refetches.push(fetch(`${baseUrl}/api/cron/sync-gsc?clientId=${clientId}&date=${gscDate}`, { headers }).catch(() => {}));
      }

      // Fire and forget — don't await
      Promise.all(refetches).catch(() => {});
    }
  } else {
    await sendTelegramMessage(
      `✅ <b>Health Check — ${yesterday}</b>\nAll ${clients.length} clients synced OK`
    );
  }

  return NextResponse.json({
    success: true,
    date: yesterday,
    gscDate,
    total: clients.length,
    ok,
    issues: refetchNeeded.length,
    missing: missing.length > 0 ? missing : undefined,
  });
}
