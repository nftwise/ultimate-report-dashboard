import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/client-dashboard
 *
 * FAST client dashboard endpoint that reads pre-computed metrics from database
 * Expected response time: ~50-100ms (vs 5-25 seconds for live API calls)
 *
 * Query params:
 * - clientId: Client slug or UUID (required)
 * - startDate: YYYY-MM-DD format (required)
 * - endDate: YYYY-MM-DD format (required)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate parameters are required'
      }, { status: 400 });
    }

    console.log(`⚡ [Client Dashboard] Fetching for ${clientId}: ${startDate} to ${endDate}`);

    // Step 1: Get client info (support both UUID and slug)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);

    let clientQuery = supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        city,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gsc_site_url,
          gbp_location_id
        )
      `);

    if (isUUID) {
      clientQuery = clientQuery.eq('id', clientId);
    } else {
      clientQuery = clientQuery.eq('slug', clientId);
    }

    const { data: client, error: clientError } = await clientQuery.single();

    if (clientError || !client) {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 });
    }

    const clientUUID = client.id;

    // Calculate previous period dates first
    const periodLength = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodLength);

    // Step 2 & 3: Fetch current and previous metrics + campaigns IN PARALLEL for speed
    const [metricsResult, prevMetricsResult, campaignsResult] = await Promise.all([
      // Current period metrics
      supabaseAdmin
        .from('client_metrics_summary')
        .select('*')
        .eq('client_id', clientUUID)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('period_type', 'daily')
        .order('date', { ascending: true }),
      // Previous period metrics
      supabaseAdmin
        .from('client_metrics_summary')
        .select('*')
        .eq('client_id', clientUUID)
        .gte('date', prevStartDate.toISOString().split('T')[0])
        .lte('date', prevEndDate.toISOString().split('T')[0])
        .eq('period_type', 'daily'),
      // Campaigns for the current period (aggregated by campaign)
      supabaseAdmin
        .from('client_campaigns')
        .select('campaign_id, campaign_name, status, impressions, clicks, cost, conversions, ctr, cpc, cost_per_conversion, search_impression_share')
        .eq('client_id', clientUUID)
        .gte('date', startDate)
        .lte('date', endDate)
    ]);

    const { data: metrics, error: metricsError } = metricsResult;
    const { data: prevMetrics } = prevMetricsResult;
    const { data: campaignsRaw } = campaignsResult;

    if (metricsError) {
      console.error('[Client Dashboard] Metrics error:', metricsError);
    }

    // Aggregate campaigns by campaign_id (combine data across dates)
    const campaignsMap = new Map<string, any>();
    (campaignsRaw || []).forEach((c: any) => {
      const existing = campaignsMap.get(c.campaign_id);
      if (existing) {
        existing.impressions += c.impressions || 0;
        existing.clicks += c.clicks || 0;
        existing.cost += parseFloat(c.cost) || 0;
        existing.conversions += parseFloat(c.conversions) || 0;
      } else {
        campaignsMap.set(c.campaign_id, {
          id: c.campaign_id,
          name: c.campaign_name,
          status: c.status,
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          cost: parseFloat(c.cost) || 0,
          conversions: parseFloat(c.conversions) || 0,
        });
      }
    });

    // Calculate derived metrics for each campaign
    const campaigns = Array.from(campaignsMap.values()).map((c: any) => ({
      ...c,
      ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0,
      cpc: c.clicks > 0 ? Math.round((c.cost / c.clicks) * 100) / 100 : 0,
      costPerConversion: c.conversions > 0 ? Math.round((c.cost / c.conversions) * 100) / 100 : 0,
    })).sort((a, b) => b.cost - a.cost); // Sort by spend descending

    // Step 4: Aggregate current period metrics
    const currentPeriod = aggregateMetrics(metrics || []);
    const previousPeriod = aggregateMetrics(prevMetrics || []);

    // Step 5: Calculate percentage changes
    const changes = calculateChanges(currentPeriod, previousPeriod);

    // Step 6: Get service config
    const serviceConfig = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs || {};

    const duration = Date.now() - startTime;
    console.log(`⚡ [Client Dashboard] Returned in ${duration}ms`);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        city: client.city,
      },
      services: {
        googleAds: !!serviceConfig.gads_customer_id,
        googleAnalytics: !!serviceConfig.ga_property_id,
        searchConsole: !!serviceConfig.gsc_site_url,
        googleBusiness: !!serviceConfig.gbp_location_id,
      },
      metrics: {
        // Google Ads
        googleAdsConversions: currentPeriod.googleAdsConversions,
        adSpend: currentPeriod.adSpend,
        cpl: currentPeriod.cpl,
        adsClicks: currentPeriod.adsClicks,
        adsImpressions: currentPeriod.adsImpressions,
        adsPhoneCalls: currentPeriod.adsPhoneCalls,
        adsCtr: currentPeriod.adsCtr,
        adsCpc: currentPeriod.adsCpc,
        adsConversionRate: currentPeriod.adsConversionRate,

        // GA4/Traffic
        sessions: currentPeriod.sessions,
        users: currentPeriod.users,
        newUsers: currentPeriod.newUsers,
        returningUsers: currentPeriod.returningUsers,
        sessionsMobile: currentPeriod.sessionsMobile,
        sessionsDesktop: currentPeriod.sessionsDesktop,
        formFills: currentPeriod.formFills,
        engagementRate: currentPeriod.engagementRate,
        conversionRate: currentPeriod.conversionRate,

        // GBP Engagement
        gbpCalls: currentPeriod.gbpCalls,
        gbpClicks: currentPeriod.gbpClicks,
        gbpDirections: currentPeriod.gbpDirections,
        gbpViews: currentPeriod.gbpViews,

        // GBP Reviews
        gbpReviewsCount: currentPeriod.gbpReviewsCount,
        gbpRatingAvg: currentPeriod.gbpRatingAvg,
        gbpNewReviews: currentPeriod.gbpNewReviews,
        gbpDaysSinceReview: currentPeriod.gbpDaysSinceReview,

        // GBP Posts
        gbpPostsCount: currentPeriod.gbpPostsCount,
        gbpPostsViews: currentPeriod.gbpPostsViews,
        gbpPostsClicks: currentPeriod.gbpPostsClicks,
        gbpDaysSincePost: currentPeriod.gbpDaysSincePost,

        // Search Console
        gscClicks: currentPeriod.gscClicks,
        gscImpressions: currentPeriod.gscImpressions,
        gscCtr: currentPeriod.gscCtr,
        gscPosition: currentPeriod.gscPosition,

        // SEO
        googleRank: currentPeriod.googleRank,
        topKeywords: currentPeriod.topKeywords,
        keywordsDeclined: currentPeriod.keywordsDeclined,

        // Traffic Sources (individual values)
        trafficOrganic: currentPeriod.trafficOrganic,
        trafficPaid: currentPeriod.trafficPaid,
        trafficDirect: currentPeriod.trafficDirect,
        trafficReferral: currentPeriod.trafficReferral,
        trafficAI: currentPeriod.trafficAI,
        nonBrandedTraffic: currentPeriod.nonBrandedTraffic,

        // Health/Budget
        healthScore: currentPeriod.healthScore,
        budgetUtilization: currentPeriod.budgetUtilization,

        // Combined
        totalLeads: currentPeriod.totalLeads,
      },
      // Traffic Sources breakdown for charts
      trafficSources: [
        { source: 'google', medium: 'organic', sessions: currentPeriod.trafficOrganic, users: Math.round(currentPeriod.trafficOrganic * 0.85) },
        { source: 'google', medium: 'cpc', sessions: currentPeriod.trafficPaid, users: Math.round(currentPeriod.trafficPaid * 0.9) },
        { source: '(direct)', medium: '(none)', sessions: currentPeriod.trafficDirect, users: Math.round(currentPeriod.trafficDirect * 0.7) },
        { source: 'referral', medium: 'referral', sessions: currentPeriod.trafficReferral, users: Math.round(currentPeriod.trafficReferral * 0.8) },
      ].filter(s => s.sessions > 0),
      // AI Traffic Sources for AITrafficOnly component
      aiTrafficSources: currentPeriod.trafficAI > 0 ? [
        { source: 'AI Assistants', medium: 'referral', sessions: currentPeriod.trafficAI, users: Math.round(currentPeriod.trafficAI * 0.9), conversions: 0 }
      ] : [],
      // Google Ads Campaigns (enabled/running campaigns with metrics)
      campaigns: campaigns,
      changes: {
        googleAdsConversions: changes.googleAdsConversions,
        adSpend: changes.adSpend,
        cpl: changes.cpl,
        formFills: changes.formFills,
        gbpCalls: changes.gbpCalls,
        totalLeads: changes.totalLeads,
      },
      // Daily data for charts
      daily: (metrics || []).map((m: any) => ({
        date: m.date,
        // GA4 Traffic metrics
        sessions: m.sessions || 0,
        users: m.users || 0,
        conversions: m.form_fills || 0,
        // Traffic Sources
        trafficOrganic: m.traffic_organic || 0,
        trafficPaid: m.traffic_paid || 0,
        trafficDirect: m.traffic_direct || 0,
        trafficReferral: m.traffic_referral || 0,
        trafficAI: m.traffic_ai || 0,
        // Google Ads
        googleAdsConversions: m.google_ads_conversions || 0,
        adSpend: parseFloat(m.ad_spend) || 0,
        adsClicks: m.ads_clicks || 0,
        adsImpressions: m.ads_impressions || 0,
        adsPhoneCalls: m.ads_phone_calls || 0,
        // GBP
        gbpCalls: m.gbp_calls || 0,
        gbpClicks: m.gbp_website_clicks || 0,
        gbpDirections: m.gbp_directions || 0,
        // SEO/GSC
        gscClicks: m.seo_clicks || 0,
        gscImpressions: m.seo_impressions || 0,
        // Combined
        formFills: m.form_fills || 0,
        totalLeads: m.total_leads || 0,
        googleRank: m.google_rank,
        topKeywords: m.top_keywords || 0,
      })),
      preComputed: true,
      duration,
      dateRange: { startDate, endDate },
    });

  } catch (error: any) {
    console.error('[Client Dashboard] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Aggregate daily metrics into totals
 */
function aggregateMetrics(metrics: any[]) {
  if (!metrics || metrics.length === 0) {
    return {
      // Google Ads
      googleAdsConversions: 0,
      adSpend: 0,
      cpl: 0,
      adsClicks: 0,
      adsImpressions: 0,
      adsPhoneCalls: 0,
      adsCtr: 0,
      adsCpc: 0,
      // GA4/Traffic
      sessions: 0,
      users: 0,
      newUsers: 0,
      returningUsers: 0,
      sessionsMobile: 0,
      sessionsDesktop: 0,
      formFills: 0,
      engagementRate: 0,
      conversionRate: 0,
      // Traffic Sources
      trafficOrganic: 0,
      trafficPaid: 0,
      trafficDirect: 0,
      trafficReferral: 0,
      trafficAI: 0,
      nonBrandedTraffic: 0,
      // GBP
      gbpCalls: 0,
      gbpClicks: 0,
      gbpDirections: 0,
      gbpViews: 0,
      // Search Console
      gscClicks: 0,
      gscImpressions: 0,
      gscCtr: 0,
      gscPosition: 0,
      // SEO
      googleRank: null,
      topKeywords: 0,
      keywordsDeclined: 0,
      // Ads advanced
      adsConversionRate: 0,
      // Health/Budget
      healthScore: 0,
      budgetUtilization: 0,
      // Combined
      totalLeads: 0,
      daysWithData: 0,
    };
  }

  let totalGoogleAdsConversions = 0;
  let totalAdSpend = 0;
  let totalAdsClicks = 0;
  let totalAdsImpressions = 0;
  let totalAdsPhoneCalls = 0;
  let totalSessions = 0;
  let totalUsers = 0;
  let totalNewUsers = 0;
  let totalReturningUsers = 0;
  let totalSessionsMobile = 0;
  let totalSessionsDesktop = 0;
  let totalFormFills = 0;
  // Traffic Sources
  let totalTrafficOrganic = 0;
  let totalTrafficPaid = 0;
  let totalTrafficDirect = 0;
  let totalTrafficReferral = 0;
  let totalTrafficAI = 0;
  let totalNonBrandedTraffic = 0;
  // GBP
  let totalGbpCalls = 0;
  let totalGbpClicks = 0;
  let totalGbpDirections = 0;
  let totalGbpViews = 0;
  // GBP Reviews/Posts (take latest non-zero values)
  let gbpReviewsCount = 0;
  let gbpRatingAvg = 0;
  let gbpNewReviews = 0;
  let gbpDaysSinceReview = 999;
  let gbpPostsCount = 0;
  let gbpPostsViews = 0;
  let gbpPostsClicks = 0;
  let gbpDaysSincePost = 999;
  let totalGscClicks = 0;
  let totalGscImpressions = 0;
  let totalLeads = 0;
  let maxTopKeywords = 0;
  let totalKeywordsDeclined = 0;
  let rankSum = 0;
  let rankCount = 0;
  let engagementSum = 0;
  let engagementCount = 0;
  let gscPositionSum = 0;
  let gscPositionCount = 0;
  let healthScoreSum = 0;
  let healthScoreCount = 0;
  let budgetUtilSum = 0;
  let budgetUtilCount = 0;

  metrics.forEach((m: any) => {
    // Google Ads
    totalGoogleAdsConversions += m.google_ads_conversions || 0;
    totalAdSpend += parseFloat(m.ad_spend) || 0;
    totalAdsClicks += m.ads_clicks || 0;
    totalAdsImpressions += m.ads_impressions || 0;
    totalAdsPhoneCalls += m.ads_phone_calls || 0;
    // GA4/Traffic
    totalSessions += m.sessions || 0;
    totalUsers += m.users || 0;
    totalNewUsers += m.new_users || 0;
    totalReturningUsers += m.returning_users || 0;
    totalSessionsMobile += m.sessions_mobile || 0;
    totalSessionsDesktop += m.sessions_desktop || 0;
    totalFormFills += m.form_fills || 0;
    if (m.engagement_rate) {
      engagementSum += parseFloat(m.engagement_rate) || 0;
      engagementCount++;
    }
    // Traffic Sources
    totalTrafficOrganic += m.traffic_organic || 0;
    totalTrafficPaid += m.traffic_paid || 0;
    totalTrafficDirect += m.traffic_direct || 0;
    totalTrafficReferral += m.traffic_referral || 0;
    totalTrafficAI += m.traffic_ai || 0;
    totalNonBrandedTraffic += m.non_branded_traffic || 0;
    // GBP (correct column names from DB)
    totalGbpCalls += m.gbp_calls || 0;
    totalGbpClicks += m.gbp_website_clicks || 0;
    totalGbpDirections += m.gbp_directions || 0;
    totalGbpViews += m.gbp_profile_views || 0;
    // GBP Reviews/Posts - take latest non-zero values (cumulative metrics)
    if (m.gbp_reviews_count > 0) gbpReviewsCount = m.gbp_reviews_count;
    if (m.gbp_rating_avg > 0) gbpRatingAvg = m.gbp_rating_avg;
    if (m.gbp_reviews_new > 0) gbpNewReviews = m.gbp_reviews_new;
    if (m.days_since_review !== null && m.days_since_review < gbpDaysSinceReview) {
      gbpDaysSinceReview = m.days_since_review;
    }
    if (m.gbp_posts_count > 0) gbpPostsCount = m.gbp_posts_count;
    if (m.gbp_posts_views > 0) gbpPostsViews = m.gbp_posts_views;
    if (m.gbp_posts_clicks > 0) gbpPostsClicks = m.gbp_posts_clicks;
    if (m.days_since_post !== null && m.days_since_post < gbpDaysSincePost) {
      gbpDaysSincePost = m.days_since_post;
    }
    // Search Console (SEO columns in DB)
    totalGscClicks += m.seo_clicks || 0;
    totalGscImpressions += m.seo_impressions || 0;
    if (m.seo_ctr) {
      gscPositionSum += parseFloat(m.seo_ctr) || 0;
      gscPositionCount++;
    }
    // Combined
    totalLeads += m.total_leads || 0;
    maxTopKeywords = Math.max(maxTopKeywords, m.top_keywords || 0);
    totalKeywordsDeclined += m.keywords_declined || 0;
    if (m.google_rank !== null && m.google_rank !== undefined) {
      rankSum += m.google_rank;
      rankCount++;
    }
    // Health/Budget
    if (m.health_score !== null && m.health_score !== undefined) {
      healthScoreSum += m.health_score;
      healthScoreCount++;
    }
    if (m.budget_utilization !== null && m.budget_utilization !== undefined) {
      budgetUtilSum += parseFloat(m.budget_utilization) || 0;
      budgetUtilCount++;
    }
  });

  const avgGoogleRank = rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null;
  const cpl = totalGoogleAdsConversions > 0
    ? Math.round((totalAdSpend / totalGoogleAdsConversions) * 100) / 100
    : 0;
  const adsCtr = totalAdsImpressions > 0
    ? Math.round((totalAdsClicks / totalAdsImpressions) * 10000) / 100
    : 0;
  const adsCpc = totalAdsClicks > 0
    ? Math.round((totalAdSpend / totalAdsClicks) * 100) / 100
    : 0;
  const adsConversionRate = totalAdsClicks > 0
    ? Math.round((totalGoogleAdsConversions / totalAdsClicks) * 10000) / 100
    : 0;
  const avgEngagement = engagementCount > 0
    ? Math.round((engagementSum / engagementCount) * 100) / 100
    : 0;
  const conversionRate = totalSessions > 0
    ? Math.round((totalFormFills / totalSessions) * 10000) / 100
    : 0;
  const avgGscPosition = gscPositionCount > 0
    ? Math.round((gscPositionSum / gscPositionCount) * 10) / 10
    : 0;
  const gscCtr = totalGscImpressions > 0
    ? Math.round((totalGscClicks / totalGscImpressions) * 10000) / 100
    : 0;
  const avgHealthScore = healthScoreCount > 0
    ? Math.round(healthScoreSum / healthScoreCount)
    : 0;
  const avgBudgetUtil = budgetUtilCount > 0
    ? Math.round((budgetUtilSum / budgetUtilCount) * 100) / 100
    : 0;

  return {
    // Google Ads
    googleAdsConversions: totalGoogleAdsConversions,
    adSpend: Math.round(totalAdSpend * 100) / 100,
    cpl: cpl,
    adsClicks: totalAdsClicks,
    adsImpressions: totalAdsImpressions,
    adsPhoneCalls: totalAdsPhoneCalls,
    adsCtr: adsCtr,
    adsCpc: adsCpc,
    adsConversionRate: adsConversionRate,
    // GA4/Traffic
    sessions: totalSessions,
    users: totalUsers,
    newUsers: totalNewUsers,
    returningUsers: totalReturningUsers,
    sessionsMobile: totalSessionsMobile,
    sessionsDesktop: totalSessionsDesktop,
    formFills: totalFormFills,
    engagementRate: avgEngagement,
    conversionRate: conversionRate,
    // Traffic Sources
    trafficOrganic: totalTrafficOrganic,
    trafficPaid: totalTrafficPaid,
    trafficDirect: totalTrafficDirect,
    trafficReferral: totalTrafficReferral,
    trafficAI: totalTrafficAI,
    nonBrandedTraffic: totalNonBrandedTraffic,
    // GBP
    gbpCalls: totalGbpCalls,
    gbpClicks: totalGbpClicks,
    gbpDirections: totalGbpDirections,
    gbpViews: totalGbpViews,
    // GBP Reviews/Posts
    gbpReviewsCount,
    gbpRatingAvg,
    gbpNewReviews,
    gbpDaysSinceReview: gbpDaysSinceReview === 999 ? null : gbpDaysSinceReview,
    gbpPostsCount,
    gbpPostsViews,
    gbpPostsClicks,
    gbpDaysSincePost: gbpDaysSincePost === 999 ? null : gbpDaysSincePost,
    // Search Console
    gscClicks: totalGscClicks,
    gscImpressions: totalGscImpressions,
    gscCtr: gscCtr,
    gscPosition: avgGscPosition,
    // SEO
    googleRank: avgGoogleRank,
    topKeywords: maxTopKeywords,
    keywordsDeclined: totalKeywordsDeclined,
    // Health/Budget
    healthScore: avgHealthScore,
    budgetUtilization: avgBudgetUtil,
    // Combined
    totalLeads: totalLeads,
    daysWithData: metrics.length,
  };
}

/**
 * Calculate percentage changes between periods
 */
function calculateChanges(current: any, previous: any) {
  const calcChange = (curr: number, prev: number): number | null => {
    if (prev === 0) {
      return curr > 0 ? 100 : null;
    }
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    googleAdsConversions: calcChange(current.googleAdsConversions, previous.googleAdsConversions),
    adSpend: calcChange(current.adSpend, previous.adSpend),
    cpl: calcChange(current.cpl, previous.cpl),
    sessions: calcChange(current.sessions, previous.sessions),
    users: calcChange(current.users, previous.users),
    formFills: calcChange(current.formFills, previous.formFills),
    gbpCalls: calcChange(current.gbpCalls, previous.gbpCalls),
    gscClicks: calcChange(current.gscClicks, previous.gscClicks),
    gscImpressions: calcChange(current.gscImpressions, previous.gscImpressions),
    totalLeads: calcChange(current.totalLeads, previous.totalLeads),
  };
}
