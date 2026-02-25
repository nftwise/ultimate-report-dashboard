#!/usr/bin/env npx tsx
/**
 * Rollup Backfill Script
 *
 * Runs the same rollup logic as /api/admin/run-rollup for 90 days of historical data.
 * Reads from all raw tables and aggregates into client_metrics_summary.
 *
 * Usage:
 *   npx tsx scripts/rollup-backfill.ts
 *   npx tsx scripts/rollup-backfill.ts --days=30
 *   npx tsx scripts/rollup-backfill.ts --client=slugname
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env from .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
const BATCH_SIZE = 5; // Process 5 clients in parallel
const UPSERT_BATCH_SIZE = 500;

// --- Parse CLI args ---
function parseDays(): number {
  const daysArg = process.argv.find(a => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 90;
  if (isNaN(days) || days < 1 || days > 365) {
    console.error('Error: --days must be between 1 and 365');
    process.exit(1);
  }
  return days;
}

function parseClientFilter(): string | null {
  const clientArg = process.argv.find(a => a.startsWith('--client='));
  return clientArg ? clientArg.split('=')[1] : null;
}

// --- Helpers ---
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Process a single client (copied from route.ts) ---
async function processClient(
  supabase: any,
  client: { id: string; name: string; slug: string; city: string },
  targetDate: string,
  prevDateStr: string,
  previousDataMap: Map<string, any>
) {
  const clientId = client.id;

  // Fetch all raw data in parallel
  const [
    ga4SessionsData,
    ga4EventsData,
    ga4LandingPagesData,
    gscSummary,
    gscQueriesData,
    adsCampaignData,
    adsConversionActionsData,
    gbpData,
  ] = await Promise.all([
    supabase
      .from('ga4_sessions')
      .select('sessions, total_users, new_users, device, source_medium, engagement_rate')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    supabase
      .from('ga4_events')
      .select('event_name, event_count, source_medium')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    supabase
      .from('ga4_landing_pages')
      .select('landing_page, sessions, conversions')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    // Pre-aggregated GSC totals — faster than summing thousands of query rows
    supabase
      .from('gsc_daily_summary')
      .select('total_impressions, total_clicks, top_keywords_count')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .single()
      .then((r: any) => r.data || null),
    // Filtered queries (top 50 + city) — still needed for google_rank + branded traffic
    supabase
      .from('gsc_queries')
      .select('query, clicks, impressions, position')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    supabase
      .from('ads_campaign_metrics')
      .select('impressions, clicks, cost, ctr, cpc, quality_score, impression_share, search_impression_share, search_lost_is_budget')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    supabase
      .from('campaign_conversion_actions')
      .select('conversions, conversion_action_name')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
    supabase
      .from('gbp_location_daily_metrics')
      .select('phone_calls, website_clicks, direction_requests, views, total_reviews, new_reviews_today, average_rating, business_photo_views, posts_count, posts_views, posts_actions')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then((r: any) => r.data || []),
  ]);

  // =====================================================
  // AGGREGATE GA4 SESSIONS
  // =====================================================
  let sessions = 0;
  let users = 0;
  let newUsers = 0;
  let sessionsDesktop = 0;
  let sessionsMobile = 0;
  let trafficOrganic = 0;
  let trafficPaid = 0;
  let trafficDirect = 0;
  let trafficReferral = 0;
  let trafficAi = 0;
  let weightedEngagement = 0;
  let totalSessionsForEngagement = 0;

  for (const row of ga4SessionsData) {
    const s = row.sessions || 0;
    sessions += s;
    users += row.total_users || 0;
    newUsers += row.new_users || 0;

    // Device breakdown
    const device = (row.device || '').toLowerCase();
    if (device === 'desktop') {
      sessionsDesktop += s;
    } else if (device === 'mobile' || device === 'tablet') {
      sessionsMobile += s;
    }

    // Traffic source breakdown
    const sm = (row.source_medium || '').toLowerCase();
    if (sm.includes('organic')) {
      trafficOrganic += s;
    } else if (sm.includes('cpc') || sm.includes('paid')) {
      trafficPaid += s;
    } else if (sm === '(direct) / (none)') {
      trafficDirect += s;
    } else if (sm.includes('referral')) {
      trafficReferral += s;
    }

    // AI traffic
    if (
      sm.includes('ai') ||
      sm.includes('chatgpt') || sm.includes('openai') ||
      sm.includes('perplexity') ||
      sm.includes('claude') || sm.includes('anthropic') ||
      sm.includes('gemini') || sm.includes('bard') ||
      sm.includes('copilot')
    ) {
      trafficAi += s;
    }

    // Weighted engagement rate
    if (row.engagement_rate != null && s > 0) {
      weightedEngagement += (row.engagement_rate || 0) * s;
      totalSessionsForEngagement += s;
    }
  }

  const returningUsers = Math.max(0, users - newUsers);
  const engagementRate = totalSessionsForEngagement > 0
    ? Math.round((weightedEngagement / totalSessionsForEngagement) * 10000) / 100
    : 0;

  // =====================================================
  // AGGREGATE GA4 EVENTS
  // =====================================================
  // form_fills: only count "success/successful" events from non-paid traffic
  // This avoids double-counting with google_ads_conversions
  let formFills = 0;
  for (const row of ga4EventsData) {
    const eventName = (row.event_name || '').toLowerCase();
    const sourceMedium = (row.source_medium || '').toLowerCase();
    const isPaid = sourceMedium.includes('cpc') || sourceMedium.includes('paid');
    const isSuccess = eventName.includes('success');
    if (isSuccess && !isPaid) {
      formFills += row.event_count || 0;
    }
  }

  // =====================================================
  // AGGREGATE GA4 LANDING PAGES
  // =====================================================
  let blogSessions = 0;
  let contentConversions = 0;

  // Aggregate sessions per landing page for top 5
  const landingPageMap = new Map<string, { sessions: number; conversions: number }>();
  for (const row of ga4LandingPagesData) {
    const page = row.landing_page || '';
    const s = row.sessions || 0;
    const c = row.conversions || 0;

    const existing = landingPageMap.get(page) || { sessions: 0, conversions: 0 };
    landingPageMap.set(page, {
      sessions: existing.sessions + s,
      conversions: existing.conversions + c,
    });

    if (page.includes('/blog')) {
      blogSessions += s;
      contentConversions += c;
    }
  }

  const topLandingPages = Array.from(landingPageMap.entries())
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 5)
    .map(([page, data]) => ({
      page,
      sessions: data.sessions,
      conversions: data.conversions,
    }));

  // =====================================================
  // AGGREGATE GSC QUERIES
  // =====================================================
  let brandedTraffic = 0;
  let nonBrandedTraffic = 0;
  let googleRank: number | null = null;

  // Read totals from pre-aggregated summary (avoids scanning thousands of query rows)
  const seoImpressions = (gscSummary as any)?.total_impressions || 0;
  const seoClicks = (gscSummary as any)?.total_clicks || 0;
  const topKeywords = (gscSummary as any)?.top_keywords_count || 0;

  if (gscQueriesData.length > 0) {
    // Google rank: average position for local chiro queries
    const cityFull = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
    const cityWords = cityFull.split(' ').filter((w: string) => w.length > 0);
    const ambiguousWords = ['new', 'north', 'south', 'east', 'west', 'the', 'san', 'los', 'las', 'el', 'la', 'de', 'del', 'city', 'beach', 'park', 'lake', 'springs', 'hills', 'valley', 'center', 'point', 'heights'];

    const localChiroQueries = gscQueriesData.filter((q: any) => {
      const query = (q.query || '').toLowerCase();
      const hasChiro = query.includes('chiropractor') || query.includes('chiropractic');
      if (!hasChiro || !cityFull) return false;
      if (query.includes('[') || query.includes(']')) return false;
      if (query.includes(cityFull)) return true;
      const uniqueWords = cityWords.filter((w: string) => !ambiguousWords.includes(w) && w.length >= 5);
      if (uniqueWords.length > 0) {
        return uniqueWords.some((word: string) => query.includes(word));
      }
      return false;
    });

    if (localChiroQueries.length > 0) {
      const totalPosition = localChiroQueries.reduce((sum: number, q: any) => sum + (q.position || 0), 0);
      googleRank = Math.round((totalPosition / localChiroQueries.length) * 10) / 10;
    }

    // Branded vs non-branded (computed from stored subset — top 50 + city queries)
    const genericWords = ['chiropractic', 'chiropractor', 'chiro', 'center', 'centre', 'clinic', 'health', 'wellness', 'care', 'family', 'spine', 'rehab', 'dental', 'dr', 'the', 'of', 'and', 'physical', 'medicine', 'animal', 'first', 'healing', 'hands', 'functional'];
    const brandWords = (client.name || '').toLowerCase().split(/[\s&]+/)
      .filter((w: string) => w.length >= 3 && !genericWords.includes(w));
    const slugWords = (client.slug || '').split('-')
      .filter((w: string) => w.length >= 3 && !genericWords.includes(w));
    const allBrandWords = [...new Set([...brandWords, ...slugWords])];

    for (const q of gscQueriesData) {
      const queryLower = (q.query || '').toLowerCase();
      const isBranded = allBrandWords.length > 0 && allBrandWords.some((bw: string) => queryLower.includes(bw));
      if (isBranded) {
        brandedTraffic += q.clicks || 0;
      } else {
        nonBrandedTraffic += q.clicks || 0;
      }
    }
  }

  const seoCtr = seoImpressions > 0
    ? Math.round((seoClicks / seoImpressions) * 10000) / 100
    : 0;

  // Keywords improved/declined (compare with previous day)
  const prevData = previousDataMap.get(clientId);
  const prevTopKeywords = prevData?.top_keywords ?? 0;
  const keywordsImproved = prevTopKeywords > 0 ? Math.max(0, topKeywords - prevTopKeywords) : 0;
  const keywordsDeclined = prevTopKeywords > 0 ? Math.max(0, prevTopKeywords - topKeywords) : 0;

  // =====================================================
  // AGGREGATE ADS CAMPAIGN METRICS
  // =====================================================
  // Conversions come from campaign_conversion_actions (accurate, matches Google Ads UI)
  // NOT from ads_campaign_metrics.conversions (can be inflated with view-through etc.)
  let googleAdsConversions = 0;
  for (const row of adsConversionActionsData) {
    googleAdsConversions += Math.round(row.conversions || 0);
  }

  let adSpend = 0;
  let adsImpressions = 0;
  let adsClicks = 0;
  let adsImpressionShare = 0;
  let adsSearchLostBudget = 0;
  let adsQualityScore = 0;
  let qualityScoreCount = 0;

  for (const row of adsCampaignData) {
    adSpend += row.cost || 0;
    adsImpressions += row.impressions || 0;
    adsClicks += row.clicks || 0;

    if (row.search_impression_share) {
      adsImpressionShare = Math.max(adsImpressionShare, row.search_impression_share || 0);
    }
    if (row.search_lost_is_budget) {
      adsSearchLostBudget = Math.max(adsSearchLostBudget, row.search_lost_is_budget || 0);
    }
    if (row.quality_score && row.quality_score > 0) {
      adsQualityScore += row.quality_score;
      qualityScoreCount++;
    }
  }

  adSpend = Math.round(adSpend * 100) / 100;
  if (qualityScoreCount > 0) {
    adsQualityScore = Math.round((adsQualityScore / qualityScoreCount) * 10) / 10;
  }

  const adsCtr = adsClicks > 0 && adsImpressions > 0
    ? Math.round((adsClicks / adsImpressions) * 10000) / 100
    : 0;
  const adsAvgCpc = adsClicks > 0
    ? Math.round((adSpend / adsClicks) * 100) / 100
    : 0;
  const adsConversionRate = adsClicks > 0
    ? Math.round((googleAdsConversions / adsClicks) * 10000) / 100
    : 0;
  // Top impression rate: use impression_share as proxy if available
  const adsTopImpressionRate = adsImpressionShare;

  // =====================================================
  // AGGREGATE GBP METRICS
  // =====================================================
  let gbpCalls = 0;
  let gbpWebsiteClicks = 0;
  let gbpDirections = 0;
  let gbpProfileViews = 0;
  let gbpReviewsCount = 0;
  let gbpReviewsNew = 0;
  let gbpRatingAvg = 0;
  let gbpRatingCount = 0;
  let gbpPhotosCount = 0;
  let gbpPostsCount = 0;
  let gbpPostsViews = 0;
  let gbpPostsClicks = 0;

  for (const row of gbpData) {
    gbpCalls += row.phone_calls || 0;
    gbpWebsiteClicks += row.website_clicks || 0;
    gbpDirections += row.direction_requests || 0;
    gbpProfileViews += row.views || 0;
    gbpReviewsCount = Math.max(gbpReviewsCount, row.total_reviews || 0);
    gbpReviewsNew += row.new_reviews_today || 0;
    if (row.average_rating && row.average_rating > 0) {
      gbpRatingAvg += row.average_rating;
      gbpRatingCount++;
    }
    gbpPhotosCount += row.business_photo_views || 0;
    gbpPostsCount = Math.max(gbpPostsCount, row.posts_count || 0);
    gbpPostsViews += row.posts_views || 0;
    gbpPostsClicks += row.posts_actions || 0;
  }

  if (gbpRatingCount > 0) {
    gbpRatingAvg = Math.round((gbpRatingAvg / gbpRatingCount) * 10) / 10;
  }

  // =====================================================
  // COMPUTED METRICS
  // =====================================================
  const totalLeads = googleAdsConversions + formFills + gbpCalls;
  const cpl = totalLeads > 0
    ? Math.round((adSpend / totalLeads) * 100) / 100
    : 0;
  const conversionRate = sessions > 0
    ? Math.round((totalLeads / sessions) * 10000) / 100
    : 0;

  // Health Score (0-100)
  let healthScore = 50;
  if (totalLeads > 0) healthScore += 15;
  if (googleRank && googleRank <= 5) healthScore += 15;
  else if (googleRank && googleRank <= 10) healthScore += 10;
  if (gbpRatingAvg >= 4.5) healthScore += 10;
  else if (gbpRatingAvg >= 4.0) healthScore += 5;
  if (gbpPostsCount > 0) healthScore += 5;
  if (gbpReviewsNew > 0) healthScore += 5;
  healthScore = Math.min(100, healthScore);

  // MoM leads change
  const prevLeads = prevData?.total_leads || totalLeads;
  const momLeadsChange = prevLeads > 0
    ? Math.round(((totalLeads - prevLeads) / prevLeads) * 10000) / 100
    : 0;

  // Alerts count
  let alertsCount = 0;
  if (gbpRatingAvg > 0 && gbpRatingAvg < 4.0) alertsCount++;
  if (googleRank && googleRank > 20) alertsCount++;
  if (adsSearchLostBudget > 50) alertsCount++;

  // Budget utilization
  const dayOfMonth = new Date(targetDate).getDate();
  const expectedSpendRate = dayOfMonth / 30;
  const budgetUtilization = Math.round(expectedSpendRate * 100);

  return {
    client_id: clientId,
    date: targetDate,
    period_type: 'daily',

    // Core metrics
    google_ads_conversions: googleAdsConversions,
    ad_spend: adSpend,
    form_fills: formFills,
    gbp_calls: gbpCalls,
    google_rank: googleRank,
    top_keywords: topKeywords,
    total_leads: totalLeads,
    cpl,

    // Traffic metrics
    sessions,
    users,
    new_users: newUsers,
    traffic_organic: trafficOrganic,
    traffic_paid: trafficPaid,
    traffic_direct: trafficDirect,
    traffic_referral: trafficReferral,
    traffic_ai: trafficAi,
    sessions_mobile: sessionsMobile,
    sessions_desktop: sessionsDesktop,

    // SEO metrics
    seo_impressions: seoImpressions,
    seo_clicks: seoClicks,
    seo_ctr: seoCtr,
    branded_traffic: brandedTraffic,
    non_branded_traffic: nonBrandedTraffic,
    keywords_improved: keywordsImproved,
    keywords_declined: keywordsDeclined,

    // Ads advanced
    ads_impressions: adsImpressions,
    ads_clicks: adsClicks,
    ads_phone_calls: 0, // Not available from campaign-level data
    ads_ctr: adsCtr,
    ads_avg_cpc: adsAvgCpc,
    ads_impression_share: adsImpressionShare,
    ads_search_lost_budget: adsSearchLostBudget,
    ads_quality_score: adsQualityScore,
    ads_conversion_rate: adsConversionRate,
    ads_top_impression_rate: adsTopImpressionRate,

    // GBP performance
    gbp_website_clicks: gbpWebsiteClicks,
    gbp_directions: gbpDirections,
    gbp_profile_views: gbpProfileViews,
    gbp_searches_direct: 0,  // Not available in raw table
    gbp_searches_discovery: 0, // Not available in raw table

    // GBP reviews
    gbp_reviews_count: gbpReviewsCount,
    gbp_reviews_new: gbpReviewsNew,
    gbp_rating_avg: gbpRatingAvg,
    gbp_q_and_a_count: 0, // Not available in raw table
    days_since_review: 0,  // Would need historical lookup

    // GBP content
    gbp_photos_count: gbpPhotosCount,
    gbp_posts_count: gbpPostsCount,
    gbp_posts_views: gbpPostsViews,
    gbp_posts_clicks: gbpPostsClicks,
    days_since_post: 0, // Would need historical lookup

    // AM metrics
    health_score: healthScore,
    mom_leads_change: momLeadsChange,
    alerts_count: alertsCount,
    budget_utilization: budgetUtilization,

    // Content metrics
    top_landing_pages: topLandingPages,
    blog_sessions: blogSessions,
    content_conversions: contentConversions,
    engagement_rate: engagementRate,
    returning_users: returningUsers,
    conversion_rate: conversionRate,

    updated_at: new Date().toISOString(),
  };
}

// --- Main ---
async function main() {
  const days = parseDays();
  const clientFilter = parseClientFilter();
  const startTime = Date.now();

  // Validate env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  // Initialize Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // yesterday

  console.log(`=== Rollup Backfill ===`);
  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)} (${days} days)`);
  if (clientFilter) console.log(`Client filter: ${clientFilter}`);
  console.log('');

  // Fetch clients
  let clientQuery = supabase
    .from('clients')
    .select('id, name, slug, city')
    .eq('is_active', true);

  if (clientFilter) {
    clientQuery = clientQuery.eq('slug', clientFilter);
  }

  const { data: clients, error: clientsError } = await clientQuery;

  if (clientsError) {
    console.error('Failed to fetch clients:', clientsError.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('No active clients found.');
    process.exit(0);
  }

  console.log(`Clients to process: ${clients.length}`);
  clients.forEach((c: any) => console.log(`  - ${c.name} (${c.slug})`));
  console.log('');

  // Generate dates array from startDate to endDate
  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  console.log(`Total dates to process: ${dates.length}`);
  console.log('');

  let totalUpserted = 0;
  const errors: string[] = [];

  // Process each date sequentially
  for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
    const targetDate = dates[dateIdx];

    // Get previous day string
    const previousDate = new Date(targetDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const prevDateStr = formatDate(previousDate);

    // Fetch previous day data for comparison
    const { data: previousData } = await supabase
      .from('client_metrics_summary')
      .select('client_id, top_keywords, total_leads')
      .eq('date', prevDateStr)
      .eq('period_type', 'daily');

    const previousDataMap = new Map(
      (previousData || []).map((d: any) => [d.client_id, d])
    );

    // Process clients in batches of BATCH_SIZE
    const metricsToSave: any[] = [];

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await Promise.all(
          batch.map((client: any) =>
            processClient(supabase, client, targetDate, prevDateStr, previousDataMap)
          )
        );
        metricsToSave.push(...batchResults);
      } catch (err: any) {
        const msg = `${targetDate} batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`;
        errors.push(msg);
        console.error(`  ERROR: ${msg}`);
      }
    }

    // Upsert to database in batches
    let dateUpserted = 0;
    for (let i = 0; i < metricsToSave.length; i += UPSERT_BATCH_SIZE) {
      const batch = metricsToSave.slice(i, i + UPSERT_BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('client_metrics_summary')
        .upsert(batch, { onConflict: 'client_id,date,period_type' });

      if (upsertError) {
        const msg = `${targetDate} upsert: ${upsertError.message}`;
        errors.push(msg);
        console.error(`  ERROR: ${msg}`);
      } else {
        dateUpserted += batch.length;
      }
    }

    totalUpserted += dateUpserted;

    // Progress output
    const pct = Math.round(((dateIdx + 1) / dates.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `[${pct}%] ${targetDate} - ${dateUpserted} clients rolled up (${dateIdx + 1}/${dates.length} days, ${elapsed}s elapsed)`
    );
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('========== SUMMARY ==========');
  console.log(`  Clients: ${clients.length}`);
  console.log(`  Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log(`  Days processed: ${dates.length}`);
  console.log(`  Total records upserted: ${totalUpserted}`);
  if (errors.length > 0) {
    console.log(`  Errors (${errors.length}):`);
    errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`  Duration: ${duration}s`);
  console.log('=============================');
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
