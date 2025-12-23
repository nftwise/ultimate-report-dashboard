import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { GoogleAdsServiceAccountConnector } from '@/lib/google-ads-service-account';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { JWT } from 'google-auth-library';
import { fetchGBPCalls, fetchGBPPerformanceMetrics } from '@/lib/gbp-token-manager';

const BATCH_SIZE = 3; // Reduced for 59 metrics
const TIMEOUT_MS = 20000; // Increased timeout per request

// AI traffic referral sources
const AI_REFERRERS = [
  'chat.openai.com', 'chatgpt.com', 'openai.com',
  'perplexity.ai', 'claude.ai', 'anthropic.com',
  'gemini.google.com', 'bard.google.com',
  'you.com', 'phind.com', 'bing.com/chat'
];

/**
 * GET /api/admin/run-rollup
 * Called by Vercel cron - runs rollup for yesterday
 */
export async function GET(request: NextRequest) {
  // Verify cron secret from header (Vercel sends CRON_SECRET in Authorization header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Call the main rollup logic with yesterday's date
  return runRollup();
}

/**
 * POST /api/admin/run-rollup
 * Fetch and save 59 metrics for all clients
 * Accepts { date?: string, secret?: string } in body
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { date, secret } = body;

  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 401 });
  }

  return runRollup(date);
}

/**
 * Main rollup logic
 */
async function runRollup(date?: string) {
  const startTime = Date.now();

  try {
    let targetDate = date;
    if (!targetDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split('T')[0];
    }

    console.log(`🌙 [Rollup] Starting 59-metric rollup for ${targetDate}`);

    // Fetch all active clients with their configs
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id, name, slug, city,
        service_configs (
          ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id
        )
      `)
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    const clientConfigs = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {};
      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        city: client.city,
        gaPropertyId: config.ga_property_id,
        adsCustomerId: config.gads_customer_id,
        gscSiteUrl: config.gsc_site_url,
        gbpLocationId: config.gbp_location_id,
      };
    });

    console.log(`👥 Processing ${clientConfigs.length} clients`);

    const timeRange = { startDate: targetDate, endDate: targetDate, period: 'custom' as const };
    const mccId = process.env.GOOGLE_ADS_MCC_ID || '8432700368';

    // =====================================================
    // FETCH ALL DATA SOURCES
    // =====================================================

    // 1. Google Ads Data (with advanced metrics)
    const adsConnector = new GoogleAdsServiceAccountConnector();
    const adsResults = new Map<string, any>();
    const clientsWithAds = clientConfigs.filter((c: any) => c.adsCustomerId);

    for (let i = 0; i < clientsWithAds.length; i += BATCH_SIZE) {
      const batch = clientsWithAds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client: any) => {
        try {
          const result = await Promise.race([
            adsConnector.getCampaignReport(timeRange, client.adsCustomerId, mccId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ]);
          return { clientId: client.id, data: result };
        } catch {
          return { clientId: client.id, data: null };
        }
      });
      const results = await Promise.all(promises);
      results.forEach((r: any) => adsResults.set(r.clientId, r.data));
    }

    // 2. Google Analytics Data (traffic, sessions, sources, device)
    const gaResults = new Map<string, any>();
    const clientsWithGA = clientConfigs.filter((c: any) => c.gaPropertyId);

    for (let i = 0; i < clientsWithGA.length; i += BATCH_SIZE) {
      const batch = clientsWithGA.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client: any) => {
        try {
          const gaConnector = new GoogleAnalyticsConnector(client.slug);

          // Fetch multiple GA4 reports in parallel
          const [events, trafficData, aiTraffic] = await Promise.all([
            Promise.race([
              gaConnector.getEventCounts(timeRange, client.gaPropertyId),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]),
            Promise.race([
              fetchGA4TrafficData(client.gaPropertyId, targetDate),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]).catch(() => null),
            Promise.race([
              fetchGA4AIReferralTraffic(client.gaPropertyId, targetDate),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]).catch(() => ({ total: 0, chatgpt: 0, perplexity: 0, claude: 0, gemini: 0, copilot: 0, other: 0 }))
          ]);

          return { clientId: client.id, events, trafficData, aiTraffic };
        } catch {
          return { clientId: client.id, events: null, trafficData: null, aiTraffic: null };
        }
      });
      const results = await Promise.all(promises);
      results.forEach((r: any) => gaResults.set(r.clientId, r));
    }

    // 3. Search Console Data (SEO metrics)
    const gscResults = new Map<string, any>();
    const clientsWithGSC = clientConfigs.filter((c: any) => c.gscSiteUrl);

    try {
      const auth = getSearchConsoleAuth();

      for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
        const batch = clientsWithGSC.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (client: any) => {
          try {
            const [queries, siteMetrics] = await Promise.all([
              Promise.race([
                fetchSearchConsoleQueries(auth, client.gscSiteUrl, targetDate, targetDate),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
              ]),
              Promise.race([
                fetchSearchConsoleSiteMetrics(auth, client.gscSiteUrl, targetDate, targetDate),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
              ]).catch(() => null)
            ]);
            return { clientId: client.id, queries, siteMetrics };
          } catch {
            return { clientId: client.id, queries: null, siteMetrics: null };
          }
        });
        const results = await Promise.all(promises);
        results.forEach((r: any) => gscResults.set(r.clientId, r));
      }
    } catch (error) {
      console.log('[Rollup] GSC auth error:', (error as Error).message);
    }

    // 4. GBP Performance Data (calls, clicks, directions, reviews)
    const gbpResults = new Map<string, any>();
    const clientsWithGBP = clientConfigs.filter((c: any) => c.gbpLocationId);

    for (let i = 0; i < clientsWithGBP.length; i += BATCH_SIZE) {
      const batch = clientsWithGBP.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (client: any) => {
        try {
          const [calls, performance] = await Promise.all([
            Promise.race([
              fetchGBPCalls(client.gbpLocationId, targetDate, targetDate),
              new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]).catch(() => 0),
            Promise.race([
              fetchGBPPerformanceMetrics(client.gbpLocationId, targetDate, targetDate),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ]).catch(() => null)
          ]);
          return { clientId: client.id, calls, performance };
        } catch {
          return { clientId: client.id, calls: 0, performance: null };
        }
      });
      const results = await Promise.all(promises);
      results.forEach((r: any) => gbpResults.set(r.clientId, r));
    }

    // 5. Get previous day data for comparison (for keywords_improved/declined)
    const previousDate = new Date(targetDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const prevDateStr = previousDate.toISOString().split('T')[0];

    const { data: previousData } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, top_keywords, total_leads')
      .eq('date', prevDateStr)
      .eq('period_type', 'daily');

    const previousDataMap = new Map(
      (previousData || []).map((d: any) => [d.client_id, d])
    );

    // =====================================================
    // AGGREGATE ALL 59 METRICS
    // =====================================================

    const metricsToSave = clientConfigs.map((client: any) => {
      const adsData = adsResults.get(client.id);
      const gaData = gaResults.get(client.id);
      const gscData = gscResults.get(client.id);
      const gbpData = gbpResults.get(client.id);
      const prevData = previousDataMap.get(client.id);

      // === CORE METRICS (existing) ===
      const googleAdsConversions = Math.round(adsData?.totalMetrics?.conversions || 0);
      const adSpend = Math.round((adsData?.totalMetrics?.cost || 0) * 100) / 100;
      const formFills = gaData?.events?.formSubmissions || 0;
      const gbpCalls = gbpData?.calls || 0;

      // === SEO METRICS ===
      const queries = gscData?.queries || [];
      const siteMetrics = gscData?.siteMetrics || {};

      let googleRank: number | null = null;
      let topKeywords = 0;
      let brandedTraffic = 0;
      let nonBrandedTraffic = 0;

      if (queries && Array.isArray(queries)) {
        topKeywords = queries.filter((q: any) => q.position <= 10).length;

        const cityFull = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
        const cityWords = cityFull.split(' ').filter((w: string) => w.length > 0);
        const ambiguousWords = ['new', 'north', 'south', 'east', 'west', 'the', 'san', 'los', 'las', 'el', 'la', 'de', 'del', 'city', 'beach', 'park', 'lake', 'springs', 'hills', 'valley', 'center', 'point', 'heights'];

        const localChiroQueries = queries.filter((q: any) => {
          const query = q.query.toLowerCase();
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
          const totalPosition = localChiroQueries.reduce((sum: number, q: any) => sum + q.position, 0);
          googleRank = Math.round((totalPosition / localChiroQueries.length) * 10) / 10;
        }

        // Branded vs non-branded
        const brandName = client.name?.toLowerCase().split(' ')[0] || '';
        queries.forEach((q: any) => {
          const queryLower = q.query.toLowerCase();
          if (brandName && queryLower.includes(brandName)) {
            brandedTraffic += q.clicks || 0;
          } else {
            nonBrandedTraffic += q.clicks || 0;
          }
        });
      }

      // Keywords improved/declined
      const prevTopKeywords = prevData?.top_keywords || topKeywords;
      const keywordsImproved = Math.max(0, topKeywords - prevTopKeywords);
      const keywordsDeclined = Math.max(0, prevTopKeywords - topKeywords);

      // === TRAFFIC METRICS ===
      const traffic = gaData?.trafficData || {};
      const sessions = traffic.sessions || 0;
      const users = traffic.users || 0;
      const newUsers = traffic.newUsers || 0;
      const trafficOrganic = traffic.organic || 0;
      const trafficPaid = traffic.paid || 0;
      const trafficDirect = traffic.direct || 0;
      const trafficReferral = traffic.referral || 0;
      const sessionsMobile = traffic.mobile || 0;
      const sessionsDesktop = traffic.desktop || 0;
      const engagementRate = traffic.engagementRate || 0;
      const returningUsers = Math.max(0, users - newUsers);

      // === AI REFERRAL TRAFFIC ===
      const aiTraffic = gaData?.aiTraffic || {};
      const trafficAi = aiTraffic.total || 0;
      const aiChatgpt = aiTraffic.chatgpt || 0;
      const aiPerplexity = aiTraffic.perplexity || 0;
      const aiClaude = aiTraffic.claude || 0;
      const aiGemini = aiTraffic.gemini || 0;
      const aiCopilot = aiTraffic.copilot || 0;

      // === ADS ADVANCED METRICS ===
      const adsMetrics = adsData?.totalMetrics || {};
      const adsImpressions = Math.round(adsMetrics.impressions || 0);
      const adsClicks = Math.round(adsMetrics.clicks || 0);
      const adsPhoneCalls = Math.round(adsMetrics.phoneCallConversions || 0);
      const adsCtr = adsClicks > 0 && adsImpressions > 0
        ? Math.round((adsClicks / adsImpressions) * 10000) / 100
        : 0;
      const adsAvgCpc = adsClicks > 0
        ? Math.round((adSpend / adsClicks) * 100) / 100
        : 0;
      const adsConversionRate = adsClicks > 0
        ? Math.round((googleAdsConversions / adsClicks) * 10000) / 100
        : 0;
      // These require Search Ads 360 or additional API calls
      const adsImpressionShare = adsMetrics.searchImpressionShare || 0;
      const adsSearchLostBudget = adsMetrics.searchBudgetLostImpressionShare || 0;
      const adsQualityScore = adsMetrics.averageQualityScore || 0;
      const adsTopImpressionRate = adsMetrics.topImpressionPercentage || 0;

      // === GBP METRICS ===
      const gbpPerf = gbpData?.performance || {};
      const gbpWebsiteClicks = gbpPerf.websiteClicks || 0;
      const gbpDirections = gbpPerf.directionRequests || 0;
      const gbpProfileViews = gbpPerf.businessProfileViews || 0;
      const gbpSearchesDirect = gbpPerf.searchesDirect || 0;
      const gbpSearchesDiscovery = gbpPerf.searchesDiscovery || 0;
      const gbpReviewsCount = gbpPerf.totalReviews || 0;
      const gbpReviewsNew = gbpPerf.newReviews || 0;
      const gbpRatingAvg = gbpPerf.averageRating || 0;
      const gbpQandACount = gbpPerf.questionsAnswers || 0;
      const daysSinceReview = gbpPerf.daysSinceLastReview || 0;
      const gbpPhotosCount = gbpPerf.photosCount || 0;
      const gbpPostsCount = gbpPerf.postsCount || 0;
      const gbpPostsViews = gbpPerf.postsViews || 0;
      const gbpPostsClicks = gbpPerf.postsClicks || 0;
      const daysSincePost = gbpPerf.daysSinceLastPost || 0;

      // === CALCULATED METRICS ===
      const totalLeads = googleAdsConversions + formFills + gbpCalls;
      const cpl = googleAdsConversions > 0
        ? Math.round((adSpend / googleAdsConversions) * 100) / 100
        : 0;
      const conversionRate = sessions > 0
        ? Math.round((totalLeads / sessions) * 10000) / 100
        : 0;

      // Health Score (0-100)
      let healthScore = 50; // Base score
      if (totalLeads > 0) healthScore += 15;
      if (googleRank && googleRank <= 5) healthScore += 15;
      else if (googleRank && googleRank <= 10) healthScore += 10;
      if (gbpRatingAvg >= 4.5) healthScore += 10;
      else if (gbpRatingAvg >= 4.0) healthScore += 5;
      if (daysSincePost <= 7) healthScore += 5;
      if (daysSinceReview <= 7) healthScore += 5;
      healthScore = Math.min(100, healthScore);

      // MoM leads change
      const prevLeads = prevData?.total_leads || totalLeads;
      const momLeadsChange = prevLeads > 0
        ? Math.round(((totalLeads - prevLeads) / prevLeads) * 10000) / 100
        : 0;

      // Alerts count
      let alertsCount = 0;
      if (daysSincePost > 14) alertsCount++;
      if (daysSinceReview > 30) alertsCount++;
      if (gbpRatingAvg > 0 && gbpRatingAvg < 4.0) alertsCount++;
      if (googleRank && googleRank > 20) alertsCount++;
      if (adsSearchLostBudget > 50) alertsCount++;

      // Budget utilization (monthly estimate)
      const dayOfMonth = new Date(targetDate).getDate();
      const expectedSpendRate = dayOfMonth / 30;
      const budgetUtilization = Math.round(expectedSpendRate * 100);

      // SEO site metrics
      const seoImpressions = siteMetrics.impressions || 0;
      const seoClicks = siteMetrics.clicks || 0;
      const seoCtr = siteMetrics.ctr || 0;

      // Content metrics (from GA)
      const blogSessions = traffic.blogSessions || 0;
      const contentConversions = traffic.contentConversions || 0;
      const topLandingPages = traffic.topPages || [];

      return {
        client_id: client.id,
        date: targetDate,
        period_type: 'daily',

        // Core metrics (8)
        google_ads_conversions: googleAdsConversions,
        ad_spend: adSpend,
        form_fills: formFills,
        gbp_calls: gbpCalls,
        google_rank: googleRank,
        top_keywords: topKeywords,
        total_leads: totalLeads,
        cpl: cpl,

        // Traffic metrics (10)
        sessions: sessions,
        users: users,
        new_users: newUsers,
        traffic_organic: trafficOrganic,
        traffic_paid: trafficPaid,
        traffic_direct: trafficDirect,
        traffic_referral: trafficReferral,
        traffic_ai: trafficAi,
        sessions_mobile: sessionsMobile,
        sessions_desktop: sessionsDesktop,

        // SEO metrics (7)
        seo_impressions: seoImpressions,
        seo_clicks: seoClicks,
        seo_ctr: seoCtr,
        branded_traffic: brandedTraffic,
        non_branded_traffic: nonBrandedTraffic,
        keywords_improved: keywordsImproved,
        keywords_declined: keywordsDeclined,

        // Ads advanced (10)
        ads_impressions: adsImpressions,
        ads_clicks: adsClicks,
        ads_phone_calls: adsPhoneCalls,
        ads_ctr: adsCtr,
        ads_avg_cpc: adsAvgCpc,
        ads_impression_share: adsImpressionShare,
        ads_search_lost_budget: adsSearchLostBudget,
        ads_quality_score: adsQualityScore,
        ads_conversion_rate: adsConversionRate,
        ads_top_impression_rate: adsTopImpressionRate,

        // GBP performance (5)
        gbp_website_clicks: gbpWebsiteClicks,
        gbp_directions: gbpDirections,
        gbp_profile_views: gbpProfileViews,
        gbp_searches_direct: gbpSearchesDirect,
        gbp_searches_discovery: gbpSearchesDiscovery,

        // GBP reviews (5)
        gbp_reviews_count: gbpReviewsCount,
        gbp_reviews_new: gbpReviewsNew,
        gbp_rating_avg: gbpRatingAvg,
        gbp_q_and_a_count: gbpQandACount,
        days_since_review: daysSinceReview,

        // GBP content (5)
        gbp_photos_count: gbpPhotosCount,
        gbp_posts_count: gbpPostsCount,
        gbp_posts_views: gbpPostsViews,
        gbp_posts_clicks: gbpPostsClicks,
        days_since_post: daysSincePost,

        // AM metrics (4)
        health_score: healthScore,
        mom_leads_change: momLeadsChange,
        alerts_count: alertsCount,
        budget_utilization: budgetUtilization,

        // Content metrics (6)
        top_landing_pages: topLandingPages,
        blog_sessions: blogSessions,
        content_conversions: contentConversions,
        engagement_rate: engagementRate,
        returning_users: returningUsers,
        conversion_rate: conversionRate,

        updated_at: new Date().toISOString(),
      };
    });

    // Upsert to database
    const { error: upsertError } = await supabaseAdmin
      .from('client_metrics_summary')
      .upsert(metricsToSave, { onConflict: 'client_id,date,period_type' });

    if (upsertError) {
      throw new Error(`Failed to save: ${upsertError.message}`);
    }

    // =====================================================
    // SAVE CAMPAIGN-LEVEL DATA
    // =====================================================
    const campaignsToSave: any[] = [];

    for (const client of clientConfigs) {
      const adsData = adsResults.get(client.id);
      if (adsData?.campaigns && Array.isArray(adsData.campaigns)) {
        for (const campaign of adsData.campaigns) {
          // Only save campaigns with activity (impressions > 0)
          if (campaign.metrics?.impressions > 0) {
            campaignsToSave.push({
              client_id: client.id,
              date: targetDate,
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              status: campaign.status,
              impressions: campaign.metrics.impressions || 0,
              clicks: campaign.metrics.clicks || 0,
              cost: Math.round((campaign.metrics.cost || 0) * 100) / 100,
              conversions: Math.round((campaign.metrics.conversions || 0) * 100) / 100,
              ctr: Math.round((campaign.metrics.ctr || 0) * 100) / 100,
              cpc: Math.round((campaign.metrics.cpc || 0) * 100) / 100,
              cost_per_conversion: Math.round((campaign.metrics.costPerConversion || 0) * 100) / 100,
              search_impression_share: Math.round((campaign.metrics.searchImpressionShare || 0) * 100) / 100,
            });
          }
        }
      }
    }

    if (campaignsToSave.length > 0) {
      const { error: campaignError } = await supabaseAdmin
        .from('client_campaigns')
        .upsert(campaignsToSave, { onConflict: 'client_id,date,campaign_id' });

      if (campaignError) {
        console.log(`[Rollup] Campaign save warning: ${campaignError.message}`);
      } else {
        console.log(`📊 [Rollup] Saved ${campaignsToSave.length} campaigns`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Rollup] Completed 59-metric rollup in ${duration}ms`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      processed: metricsToSave.length,
      metrics: 59,
      duration,
    });

  } catch (error: any) {
    console.error('[Rollup] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getSearchConsoleAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials');
  }
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
}

async function fetchSearchConsoleQueries(
  auth: JWT,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 100,
      dataState: 'final'
    })
  });

  if (!response.ok) throw new Error(`GSC API error: ${response.status}`);

  const data = await response.json();
  return (data.rows || []).map((row: any) => ({
    query: row.keys[0],
    position: row.position,
    clicks: row.clicks,
    impressions: row.impressions
  }));
}

async function fetchSearchConsoleSiteMetrics(
  auth: JWT,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ impressions: number; clicks: number; ctr: number }> {
  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dataState: 'final'
    })
  });

  if (!response.ok) return { impressions: 0, clicks: 0, ctr: 0 };

  const data = await response.json();
  const rows = data.rows || [];
  const totals = rows.reduce((acc: any, row: any) => ({
    impressions: acc.impressions + (row.impressions || 0),
    clicks: acc.clicks + (row.clicks || 0)
  }), { impressions: 0, clicks: 0 });

  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0
  };
}

async function fetchGA4TrafficData(propertyId: string, date: string): Promise<any> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) return null;

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly']
  });

  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';

  // Fetch traffic by source
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: date, endDate: date }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'deviceCategory' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'engagementRate' }
        ]
      })
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const rows = data.rows || [];

  const result = {
    sessions: 0,
    users: 0,
    newUsers: 0,
    organic: 0,
    paid: 0,
    direct: 0,
    referral: 0,
    ai: 0,
    mobile: 0,
    desktop: 0,
    engagementRate: 0,
    blogSessions: 0,
    contentConversions: 0,
    topPages: []
  };

  rows.forEach((row: any) => {
    const channel = row.dimensionValues?.[0]?.value?.toLowerCase() || '';
    const device = row.dimensionValues?.[1]?.value?.toLowerCase() || '';
    const sessions = parseInt(row.metricValues?.[0]?.value || '0');
    const users = parseInt(row.metricValues?.[1]?.value || '0');
    const newUsers = parseInt(row.metricValues?.[2]?.value || '0');
    const engagement = parseFloat(row.metricValues?.[3]?.value || '0');

    result.sessions += sessions;
    result.users += users;
    result.newUsers += newUsers;
    result.engagementRate = Math.max(result.engagementRate, engagement * 100);

    // Traffic by source
    if (channel.includes('organic')) result.organic += sessions;
    else if (channel.includes('paid')) result.paid += sessions;
    else if (channel.includes('direct')) result.direct += sessions;
    else if (channel.includes('referral')) result.referral += sessions;

    // Device
    if (device === 'mobile') result.mobile += sessions;
    else if (device === 'desktop') result.desktop += sessions;
  });

  // Fetch blog sessions separately (pages with /blog/ in path)
  try {
    const blogResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: date, endDate: date }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' }
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'CONTAINS',
                value: '/blog',
                caseSensitive: false
              }
            }
          }
        })
      }
    );

    if (blogResponse.ok) {
      const blogData = await blogResponse.json();
      const blogRows = blogData.rows || [];

      blogRows.forEach((row: any) => {
        result.blogSessions += parseInt(row.metricValues?.[0]?.value || '0');
        result.contentConversions += parseInt(row.metricValues?.[1]?.value || '0');
      });
    }
  } catch (e) {
    // Blog tracking is optional
  }

  return result;
}

/**
 * Fetch AI referral traffic from GA4
 * Checks sessionSource for known AI platforms
 */
async function fetchGA4AIReferralTraffic(propertyId: string, date: string): Promise<{
  total: number;
  chatgpt: number;
  perplexity: number;
  claude: number;
  gemini: number;
  copilot: number;
  other: number;
}> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    return { total: 0, chatgpt: 0, perplexity: 0, claude: 0, gemini: 0, copilot: 0, other: 0 };
  }

  try {
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token || '';

    // Fetch sessions by source/medium to find AI referrals
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: date, endDate: date }],
          dimensions: [{ name: 'sessionSource' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: {
            orGroup: {
              expressions: AI_REFERRERS.map(referrer => ({
                filter: {
                  fieldName: 'sessionSource',
                  stringFilter: {
                    matchType: 'CONTAINS',
                    value: referrer.split('.')[0], // Get main domain part
                    caseSensitive: false
                  }
                }
              }))
            }
          }
        })
      }
    );

    if (!response.ok) {
      return { total: 0, chatgpt: 0, perplexity: 0, claude: 0, gemini: 0, copilot: 0, other: 0 };
    }

    const data = await response.json();
    const rows = data.rows || [];

    const result = {
      total: 0,
      chatgpt: 0,
      perplexity: 0,
      claude: 0,
      gemini: 0,
      copilot: 0,
      other: 0
    };

    rows.forEach((row: any) => {
      const source = (row.dimensionValues?.[0]?.value || '').toLowerCase();
      const sessions = parseInt(row.metricValues?.[0]?.value || '0');

      result.total += sessions;

      if (source.includes('chatgpt') || source.includes('openai')) {
        result.chatgpt += sessions;
      } else if (source.includes('perplexity')) {
        result.perplexity += sessions;
      } else if (source.includes('claude') || source.includes('anthropic')) {
        result.claude += sessions;
      } else if (source.includes('gemini') || source.includes('bard')) {
        result.gemini += sessions;
      } else if (source.includes('bing') || source.includes('copilot')) {
        result.copilot += sessions;
      } else {
        result.other += sessions;
      }
    });

    return result;
  } catch (error) {
    console.error('[GA4] AI referral fetch error:', error);
    return { total: 0, chatgpt: 0, perplexity: 0, claude: 0, gemini: 0, copilot: 0, other: 0 };
  }
}
