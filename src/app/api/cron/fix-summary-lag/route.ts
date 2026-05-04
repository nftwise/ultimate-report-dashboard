import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { saveCronStatus } from '@/lib/telegram';
import { toCaliforniaDate } from '@/lib/timezone';

export const dynamic = 'force-dynamic'

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
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const dateParam = request.nextUrl.searchParams.get('date');

  // Build list of dates to patch: last 60 days, or a specific date.
  // GBP lag worst-case: 30 days. Ads retroactive adjustments: up to 60 days.
  // Stale data outside 10 days would never be patched with the old window.
  const datesToPatch: string[] = dateParam ? [dateParam] : (() => {
    const caToday = toCaliforniaDate();
    const dates: string[] = [];
    for (let i = 1; i <= 60; i++) {
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
  let adsPatched = 0;

  // ── 1. Patch SEO columns from gsc_daily_summary ─────────────────────────
  // Find summary rows where top_keywords = 0 but gsc_daily_summary has non-zero data
  const { data: gscData } = await supabaseAdmin
    .from('gsc_daily_summary')
    .select('client_id, date, top_keywords_count, total_impressions, total_clicks')
    .gte('date', startDate)
    .lte('date', endDate)
    .or('top_keywords_count.gt.0,total_impressions.gt.0,total_clicks.gt.0')
    .limit(10000);

  if (gscData && gscData.length > 0) {
    // Get current summary rows for these clients/dates
    const { data: summaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, top_keywords, seo_impressions, seo_clicks')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(10000);

    const summaryMap = new Map(
      (summaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const gsc of gscData) {
      const key = `${gsc.client_id}:${gsc.date}`;
      const summary = summaryMap.get(key);
      if (!summary) continue;

      // Patch any GSC column that is stale zero but source has non-zero data.
      // top_keywords, seo_impressions and seo_clicks can all be independently stale.
      const needsKeywords    = (summary.top_keywords   === 0 || summary.top_keywords   === null) && gsc.top_keywords_count > 0;
      const needsImpressions = (summary.seo_impressions === 0 || summary.seo_impressions === null) && gsc.total_impressions > 0;
      const needsClicks      = (summary.seo_clicks      === 0 || summary.seo_clicks      === null) && gsc.total_clicks > 0;

      if (!needsKeywords && !needsImpressions && !needsClicks) continue;

      const patch: Record<string, number> = {};
      if (needsKeywords)    patch.top_keywords    = gsc.top_keywords_count;
      if (needsImpressions) patch.seo_impressions = gsc.total_impressions;
      if (needsClicks) {
        patch.seo_clicks = gsc.total_clicks;
        // Recompute CTR when both clicks and impressions are now known
        const impressions = needsImpressions ? gsc.total_impressions : (summary.seo_impressions || 0);
        patch.seo_ctr = impressions > 0
          ? Math.round((gsc.total_clicks / impressions) * 10000) / 100
          : 0;
      }

      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update(patch)
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
    .lte('date', endDate)
    .limit(10000);

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

    // Get current summary rows — fetch all 4 GBP columns for column-by-column check
    const { data: gbpSummaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(10000);

    const gbpSummaryMap = new Map(
      (gbpSummaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const [key, agg] of gbpAgg) {
      // Skip if no real data
      if (agg.views === 0 && agg.calls === 0 && agg.web === 0 && agg.dirs === 0) continue;

      const summary = gbpSummaryMap.get(key);
      if (!summary) continue;

      // Patch each GBP column independently — update when summary is zero/null OR when
      // the source value is greater (GBP API retroactively finalizes data, so later
      // fetches can return higher numbers than earlier ones).
      const needsViews = agg.views > 0 && (summary.gbp_profile_views === 0 || summary.gbp_profile_views === null || agg.views > summary.gbp_profile_views);
      const needsCalls = agg.calls > 0 && (summary.gbp_calls         === 0 || summary.gbp_calls         === null || agg.calls > summary.gbp_calls);
      const needsWeb   = agg.web   > 0 && (summary.gbp_website_clicks === 0 || summary.gbp_website_clicks === null || agg.web > summary.gbp_website_clicks);
      const needsDirs  = agg.dirs  > 0 && (summary.gbp_directions     === 0 || summary.gbp_directions     === null || agg.dirs > summary.gbp_directions);

      if (!needsViews && !needsCalls && !needsWeb && !needsDirs) continue;

      const patch: Record<string, number> = {};
      if (needsViews) patch.gbp_profile_views  = agg.views;
      if (needsCalls) patch.gbp_calls          = agg.calls;
      if (needsWeb)   patch.gbp_website_clicks = agg.web;
      if (needsDirs)  patch.gbp_directions     = agg.dirs;

      const [clientId, date] = key.split(':');
      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update(patch)
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (!error) gbpPatched++;
      else console.log(`[fix-summary-lag] GBP patch error ${clientId} ${date}: ${error.message}`);
    }
  }

  // ── 3. Patch GA4 session columns from ga4_sessions ─────────────────────────
  // If sessions/users/traffic totals are 0 in summary but raw table has data,
  // re-aggregate and patch. Covers API thresholding failures that left stale zeros.
  let ga4Patched = 0;

  const { data: ga4SessionsRaw } = await supabaseAdmin
    .from('ga4_sessions')
    .select('client_id, date, sessions, total_users, new_users, device, source_medium')
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(10000);

  if (ga4SessionsRaw && ga4SessionsRaw.length > 0) {
    // Aggregate by client_id + date
    type GA4Agg = { sessions: number; users: number; newUsers: number; organic: number; paid: number; direct: number; referral: number };
    const ga4Agg = new Map<string, GA4Agg>();
    for (const r of ga4SessionsRaw) {
      const key = `${r.client_id}:${r.date}`;
      const cur = ga4Agg.get(key) || { sessions: 0, users: 0, newUsers: 0, organic: 0, paid: 0, direct: 0, referral: 0 };
      const s = r.sessions || 0;
      cur.sessions += s;
      cur.users += r.total_users || 0;
      cur.newUsers += r.new_users || 0;
      const sm = (r.source_medium || '').toLowerCase();
      if (sm.includes('organic'))                            cur.organic += s;
      else if (sm.includes('cpc') || sm.includes('paid'))   cur.paid    += s;
      else if (sm === '(direct) / (none)')                   cur.direct  += s;
      else if (sm.includes('referral'))                      cur.referral += s;
      ga4Agg.set(key, cur);
    }

    // Get current summary rows — only interested in stale-zero sessions
    const { data: ga4SummaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, sessions, users')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(10000);

    const ga4SummaryMap = new Map(
      (ga4SummaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const [key, agg] of ga4Agg) {
      if (agg.sessions === 0) continue;

      const summary = ga4SummaryMap.get(key);
      // Only patch if summary sessions is currently zero but raw data is non-zero
      if (!summary || (summary.sessions !== 0 && summary.sessions !== null)) continue;

      const [clientId, date] = key.split(':');
      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update({
          sessions:         agg.sessions,
          users:            agg.users,
          new_users:        agg.newUsers,
          returning_users:  Math.max(0, agg.users - agg.newUsers),
          traffic_organic:  agg.organic,
          traffic_paid:     agg.paid,
          traffic_direct:   agg.direct,
          traffic_referral: agg.referral,
        })
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (!error) ga4Patched++;
      else console.log(`[fix-summary-lag] GA4 patch error ${clientId} ${date}: ${error.message}`);
    }
  }

  // ── 4. Patch Ads columns from ads_campaign_metrics ─────────────────────────
  // Google Ads adjusts numbers retroactively (conversion attribution windows,
  // quality scores, impression shares). Rollup only runs for yesterday, so
  // older rows can become stale. Re-aggregate and patch any row where the
  // summary ad_spend or google_ads_conversions differs from the raw source.
  const { data: adsCampaignRaw } = await supabaseAdmin
    .from('ads_campaign_metrics')
    .select('client_id, date, impressions, clicks, cost, conversions, search_impression_share, search_lost_is_budget, quality_score')
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(10000);

  if (adsCampaignRaw && adsCampaignRaw.length > 0) {
    // Aggregate by client_id + date
    type AdsAgg = {
      spend: number; impressions: number; clicks: number; conversions: number;
      impressionShare: number; searchLostBudget: number; qualityScoreSum: number; qualityScoreCount: number;
    };
    const adsAgg = new Map<string, AdsAgg>();
    for (const r of adsCampaignRaw) {
      const key = `${r.client_id}:${r.date}`;
      const cur = adsAgg.get(key) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, impressionShare: 0, searchLostBudget: 0, qualityScoreSum: 0, qualityScoreCount: 0 };
      cur.spend       += r.cost        || 0;
      cur.impressions += r.impressions || 0;
      cur.clicks      += r.clicks      || 0;
      cur.conversions += r.conversions || 0;
      cur.impressionShare   = Math.max(cur.impressionShare,   r.search_impression_share  || 0);
      cur.searchLostBudget  = Math.max(cur.searchLostBudget,  r.search_lost_is_budget    || 0);
      if (r.quality_score && r.quality_score > 0) {
        cur.qualityScoreSum   += r.quality_score;
        cur.qualityScoreCount += 1;
      }
      adsAgg.set(key, cur);
    }

    // Get current summary rows for comparison
    const { data: adsSummaryRows } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, ad_spend, google_ads_conversions, ads_impressions, ads_clicks, ads_impression_share, ads_search_lost_budget, ads_quality_score')
      .eq('period_type', 'daily')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(10000);

    const adsSummaryMap = new Map(
      (adsSummaryRows || []).map(r => [`${r.client_id}:${r.date}`, r])
    );

    for (const [key, agg] of adsAgg) {
      if (agg.spend === 0 && agg.conversions === 0 && agg.impressions === 0) continue;

      const summary = adsSummaryMap.get(key);
      if (!summary) continue;

      const freshSpend       = Math.round(agg.spend * 100) / 100;
      const freshConversions = Math.round(agg.conversions);
      const freshQs          = agg.qualityScoreCount > 0
        ? Math.round((agg.qualityScoreSum / agg.qualityScoreCount) * 10) / 10
        : 0;
      const freshCtr = agg.impressions > 0
        ? Math.round((agg.clicks / agg.impressions) * 10000) / 100
        : 0;
      const freshCpc = agg.clicks > 0
        ? Math.round((agg.spend / agg.clicks) * 100) / 100
        : 0;
      const freshConvRate = agg.clicks > 0
        ? Math.round((agg.conversions / agg.clicks) * 10000) / 100
        : 0;

      // Detect staleness: spend or conversions differ from current summary
      const spendDiffers       = Math.abs((summary.ad_spend || 0) - freshSpend) > 0.01;
      const conversionsDiffer  = (summary.google_ads_conversions || 0) !== freshConversions;
      const impressionsDiffer  = (summary.ads_impressions || 0) !== agg.impressions;

      if (!spendDiffers && !conversionsDiffer && !impressionsDiffer) continue;

      const [clientId, date] = key.split(':');
      const { error } = await supabaseAdmin
        .from('client_metrics_summary')
        .update({
          ad_spend:               freshSpend,
          google_ads_conversions: freshConversions,
          ads_impressions:        agg.impressions,
          ads_clicks:             agg.clicks,
          ads_ctr:                freshCtr,
          ads_avg_cpc:            freshCpc,
          ads_conversion_rate:    freshConvRate,
          ads_impression_share:   agg.impressionShare,
          ads_search_lost_budget: agg.searchLostBudget,
          ads_quality_score:      freshQs,
          ads_top_impression_rate: agg.impressionShare,
        })
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (!error) adsPatched++;
      else console.log(`[fix-summary-lag] Ads patch error ${clientId} ${date}: ${error.message}`);
    }
  }

  const duration = Date.now() - startTime;
  const totalPatched = seoPatched + gbpPatched + ga4Patched + adsPatched;
  console.log(`[fix-summary-lag] Done in ${duration}ms: SEO=${seoPatched} GBP=${gbpPatched} GA4=${ga4Patched} Ads=${adsPatched} rows patched`);

  // Save cron status (fire-and-forget)
  saveCronStatus(supabaseAdmin, 'fix_summary_lag', {
    records: totalPatched,
    errors: [],
    duration,
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    dates: { from: startDate, to: endDate },
    patched: { seo: seoPatched, gbp: gbpPatched, ga4: ga4Patched, ads: adsPatched },
    duration,
  });
}
