import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300;

/**
 * GET /api/cron/fix-summary-lag
 * Runs after sync-gsc + sync-gbp + rollup to patch stale-zero rows.
 *
 * Problem: rollup runs once daily for "yesterday". But GSC has 2-3 day lag
 * and GBP has 3-7 day lag — so rollup can write 0 for a metric, and
 * sync never re-triggers the rollup for that date.
 *
 * Fix: this cron reads fresh data from gsc_daily_summary and
 * gbp_location_daily_metrics, and directly updates the affected columns
 * in client_metrics_summary for any row that has stale zeros.
 *
 * Schedule: runs at 10:20 UTC (5 min after rollup at 10:15)
 * Only updates rows where the column is currently 0 but fresh source has non-zero data.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const dateParam = request.nextUrl.searchParams.get('date');

  // Build list of dates to patch: last 10 days, or a specific date
  const datesToPatch: string[] = dateParam ? [dateParam] : (() => {
    const now = new Date();
    const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const dates: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const d = new Date(caToday);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return dates;
  })();

  const startDate = datesToPatch[datesToPatch.length - 1];
  const endDate = datesToPatch[0];

  console.log(`[fix-summary-lag] Patching ${datesToPatch.length} days: ${startDate} → ${endDate}`);

  let seoPatched = 0;
  let gbpPatched = 0;

  // ── 1. Patch SEO columns from gsc_daily_summary ─────────────────────────
  // Find summary rows where top_keywords = 0 but gsc_daily_summary has non-zero data
  const { data: gscData } = await supabaseAdmin
    .from('gsc_daily_summary')
    .select('client_id, date, top_keywords_count, total_impressions, total_clicks')
    .gte('date', startDate)
    .lte('date', endDate)
    .gt('top_keywords_count', 0);

  if (gscData && gscData.length > 0) {
    // Get current summary rows for these clients/dates
    const { data: summaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, top_keywords, seo_impressions')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate);

    const summaryMap = new Map(
      (summaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const gsc of gscData) {
      const key = `${gsc.client_id}:${gsc.date}`;
      const summary = summaryMap.get(key);

      // Only patch if summary has stale zero for top_keywords
      if (!summary || (summary.top_keywords !== 0 && summary.top_keywords !== null)) continue;

      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update({ top_keywords: gsc.top_keywords_count })
        .eq('client_id', gsc.client_id)
        .eq('date', gsc.date)
        .eq('period_type', 'daily');

      if (!error) seoPatched++;
      else console.log(`[fix-summary-lag] SEO patch error ${gsc.client_id} ${gsc.date}: ${error.message}`);
    }
  }

  // ── 2. Patch GBP columns from gbp_location_daily_metrics ────────────────
  // Aggregate by client (sum across locations)
  const { data: gbpData } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('client_id, date, phone_calls, views, website_clicks, direction_requests')
    .gte('date', startDate)
    .lte('date', endDate);

  if (gbpData && gbpData.length > 0) {
    // Aggregate by client_id + date
    const gbpAgg = new Map<string, { calls: number; views: number; web: number; dirs: number }>();
    for (const r of gbpData) {
      const key = `${r.client_id}:${r.date}`;
      const cur = gbpAgg.get(key) || { calls: 0, views: 0, web: 0, dirs: 0 };
      cur.calls += r.phone_calls || 0;
      cur.views += r.views || 0;
      cur.web += r.website_clicks || 0;
      cur.dirs += r.direction_requests || 0;
      gbpAgg.set(key, cur);
    }

    // Get current summary rows
    const { data: gbpSummaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, gbp_profile_views, gbp_calls')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate);

    const gbpSummaryMap = new Map(
      (gbpSummaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const [key, agg] of gbpAgg) {
      // Skip if no real data
      if (agg.views === 0 && agg.calls === 0 && agg.web === 0 && agg.dirs === 0) continue;

      const summary = gbpSummaryMap.get(key);
      // Only patch if summary has stale zeros
      if (!summary || (summary.gbp_profile_views !== 0 && summary.gbp_profile_views !== null)) continue;

      const [clientId, date] = key.split(':');
      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update({
          gbp_calls: agg.calls,
          gbp_profile_views: agg.views,
          gbp_website_clicks: agg.web,
          gbp_directions: agg.dirs,
        })
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (!error) gbpPatched++;
      else console.log(`[fix-summary-lag] GBP patch error ${clientId} ${date}: ${error.message}`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[fix-summary-lag] Done in ${duration}ms: SEO=${seoPatched} GBP=${gbpPatched} rows patched`);

  return NextResponse.json({
    success: true,
    dates: { from: startDate, to: endDate },
    patched: { seo: seoPatched, gbp: gbpPatched },
    duration,
  });
}
