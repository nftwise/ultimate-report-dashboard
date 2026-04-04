import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 60;

/**
 * GET /api/cron/sync-status
 *
 * Returns health status of all cron sync jobs, read from system_settings.
 * Also runs data quality checks:
 * 1. Compares gsc_daily_summary vs client_metrics_summary for yesterday (flag >5% diff)
 * 2. Flags clients with 0 data for 3+ consecutive days (data drop detection)
 * 3. Sends Telegram alert if issues found
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  // ── 1. Read all cron statuses from system_settings ───────────────────────
  const cronKeys = [
    'cron_status_sync_ga4',
    'cron_status_sync_gsc',
    'cron_status_sync_ads',
    'cron_status_sync_gbp',
    'cron_status_fix_summary_lag',
    'cron_status_run_rollup',
  ];

  const { data: settingsRows } = await supabaseAdmin
    .from('system_settings')
    .select('key, value, updated_at')
    .in('key', cronKeys);

  const cronStatuses: Record<string, any> = {};
  for (const row of settingsRows || []) {
    try {
      cronStatuses[row.key] = {
        ...(typeof row.value === 'object' ? row.value : JSON.parse(row.value || '{}')),
        savedAt: row.updated_at,
      };
    } catch {
      cronStatuses[row.key] = { raw: row.value, savedAt: row.updated_at };
    }
  }

  // ── 2. Data quality checks ───────────────────────────────────────────────
  const now = new Date();
  const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

  // Yesterday in CA timezone
  const yesterday = new Date(caToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // 3 days ago for the "3 consecutive zero days" check
  const threeDaysAgo = new Date(caToday);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(threeDaysAgo.getDate()).padStart(2, '0')}`;

  const qualityIssues: string[] = [];

  // Check 2a: GSC discrepancy (gsc_daily_summary vs client_metrics_summary)
  const [gscSummaryRes, metricsSummaryRes] = await Promise.all([
    supabaseAdmin
      .from('gsc_daily_summary')
      .select('client_id, total_clicks, total_impressions')
      .eq('date', yesterdayStr),
    supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, seo_clicks, seo_impressions')
      .eq('date', yesterdayStr)
      .eq('period_type', 'daily'),
  ]);

  const gscMap = new Map<string, { clicks: number; impressions: number }>();
  for (const row of gscSummaryRes.data || []) {
    gscMap.set(row.client_id, { clicks: row.total_clicks || 0, impressions: row.total_impressions || 0 });
  }

  const summaryMap = new Map<string, { clicks: number; impressions: number }>();
  for (const row of metricsSummaryRes.data || []) {
    summaryMap.set(row.client_id, { clicks: row.seo_clicks || 0, impressions: row.seo_impressions || 0 });
  }

  for (const [clientId, gsc] of gscMap) {
    const summary = summaryMap.get(clientId);
    if (!summary) continue;
    if (gsc.clicks === 0 && summary.clicks === 0) continue; // both zero, skip

    if (gsc.clicks > 0 && summary.clicks > 0) {
      const diff = Math.abs(gsc.clicks - summary.clicks) / gsc.clicks;
      if (diff > 0.05) {
        qualityIssues.push(`Client ${clientId}: GSC clicks mismatch on ${yesterdayStr} — source=${gsc.clicks} vs summary=${summary.clicks} (${Math.round(diff * 100)}% diff)`);
      }
    } else if (gsc.clicks > 0 && summary.clicks === 0) {
      qualityIssues.push(`Client ${clientId}: GSC has ${gsc.clicks} clicks on ${yesterdayStr} but summary shows 0 — rollup may not have run`);
    }
  }

  // Check 2b: Clients with 0 sessions for 3+ consecutive days
  const { data: zeroSessionRows } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('client_id, date, sessions')
    .gte('date', threeDaysAgoStr)
    .lte('date', yesterdayStr)
    .eq('period_type', 'daily')
    .eq('sessions', 0);

  // Group by client_id and count consecutive zero days
  const zeroCountByClient = new Map<string, number>();
  for (const row of zeroSessionRows || []) {
    zeroCountByClient.set(row.client_id, (zeroCountByClient.get(row.client_id) || 0) + 1);
  }

  // Get client names for the flagged clients
  const zeroClientIds = [...zeroCountByClient.entries()]
    .filter(([, count]) => count >= 3)
    .map(([id]) => id);

  if (zeroClientIds.length > 0) {
    const { data: clientNames } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .in('id', zeroClientIds)
      .eq('is_active', true);

    const nameMap = new Map<string, string>((clientNames || []).map((c: any) => [c.id, c.name]));
    for (const clientId of zeroClientIds) {
      const name = nameMap.get(clientId) || clientId;
      qualityIssues.push(`${name}: 0 sessions for 3+ consecutive days (${threeDaysAgoStr} → ${yesterdayStr}) — possible data drop or GA4 outage`);
    }
  }

  // ── 3. Send Telegram alert if quality issues found ───────────────────────
  if (qualityIssues.length > 0) {
    const lines = qualityIssues.slice(0, 15).map(i => `  • ${i}`).join('\n');
    const more = qualityIssues.length > 15 ? `\n  ... and ${qualityIssues.length - 15} more` : '';
    const message =
      `⚠️ <b>Data Quality Issues — ${yesterdayStr}</b>\n` +
      `${qualityIssues.length} issue(s) detected:\n\n` +
      lines + more;
    sendTelegramMessage(message).catch(() => {}); // fire-and-forget
  }

  const duration = Date.now() - startTime;
  console.log(`[sync-status] Done in ${duration}ms — ${qualityIssues.length} quality issues, ${Object.keys(cronStatuses).length} cron statuses`);

  return NextResponse.json({
    success: true,
    checkedDate: yesterdayStr,
    cronStatuses,
    qualityCheck: {
      issues: qualityIssues,
      issueCount: qualityIssues.length,
      gscDiscrepancies: qualityIssues.filter(i => i.includes('clicks')).length,
      dataDrops: zeroClientIds.length,
    },
    duration,
  });
}
