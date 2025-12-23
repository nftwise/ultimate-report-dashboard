import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/overview-fast
 * INSTANT endpoint that reads pre-computed metrics from database
 *
 * This is Solution #6: Pre-computed Daily Rollups
 * Expected response time: ~50-100ms (vs 25+ seconds for live API calls)
 *
 * Query params:
 * - startDate: YYYY-MM-DD format
 * - endDate: YYYY-MM-DD format
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate parameters are required'
      }, { status: 400 });
    }

    console.log(`⚡ [Overview Fast] Fetching pre-computed metrics: ${startDate} to ${endDate}`);

    // Step 1: Get all active clients with service configs
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          gads_customer_id,
          gsc_site_url,
          gbp_location_id
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    // Step 2: Get pre-computed metrics for date range (SUM aggregation)
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('period_type', 'daily')
      .order('date', { ascending: true });

    if (metricsError) {
      console.error('[Overview Fast] Metrics error:', metricsError);
      // Fall back to empty metrics if table doesn't exist yet
    }

    // Step 3: Get last 7 days for sparkline trend
    const today = new Date(endDate);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sparklineStart = sevenDaysAgo.toISOString().split('T')[0];

    const { data: trendMetrics } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, total_leads')
      .gte('date', sparklineStart)
      .lte('date', endDate)
      .eq('period_type', 'daily')
      .order('date', { ascending: true });

    // Build sparkline data per client
    const sparklineMap = new Map<string, number[]>();
    (trendMetrics || []).forEach((row: any) => {
      const existing = sparklineMap.get(row.client_id) || [];
      existing.push(row.total_leads || 0);
      sparklineMap.set(row.client_id, existing);
    });

    // Step 4: Calculate previous period for comparison
    const periodLength = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodLength);

    const { data: prevMetrics } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, total_leads')
      .gte('date', prevStartDate.toISOString().split('T')[0])
      .lte('date', prevEndDate.toISOString().split('T')[0])
      .eq('period_type', 'daily');

    // Sum previous period leads per client
    const prevLeadsMap = new Map<string, number>();
    (prevMetrics || []).forEach((row: any) => {
      const existing = prevLeadsMap.get(row.client_id) || 0;
      prevLeadsMap.set(row.client_id, existing + (row.total_leads || 0));
    });

    // Step 5: Aggregate metrics per client
    const metricsMap = new Map<string, {
      googleAdsConversions: number;
      adSpend: number;
      formFills: number;
      gbpCalls: number;
      googleRank: number | null;
      topKeywords: number;
      totalLeads: number;
      cpl: number;
      daysWithData: number;
      // Additional metrics
      sessions: number;
      users: number;
      adsClicks: number;
      adsImpressions: number;
      gscClicks: number;
      gscImpressions: number;
      gbpClicks: number;
      gbpViews: number;
    }>();

    // Initialize all clients with zero values
    (clients || []).forEach((client: any) => {
      metricsMap.set(client.id, {
        googleAdsConversions: 0,
        adSpend: 0,
        formFills: 0,
        gbpCalls: 0,
        googleRank: null,
        topKeywords: 0,
        totalLeads: 0,
        cpl: 0,
        daysWithData: 0,
        // Additional metrics
        sessions: 0,
        users: 0,
        adsClicks: 0,
        adsImpressions: 0,
        gscClicks: 0,
        gscImpressions: 0,
        gbpClicks: 0,
        gbpViews: 0,
      });
    });

    // Sum up daily metrics
    (metrics || []).forEach((row: any) => {
      const existing = metricsMap.get(row.client_id);
      if (existing) {
        existing.googleAdsConversions += row.google_ads_conversions || 0;
        existing.adSpend += parseFloat(row.ad_spend) || 0;
        existing.formFills += row.form_fills || 0;
        existing.gbpCalls += row.gbp_calls || 0;
        existing.topKeywords = Math.max(existing.topKeywords, row.top_keywords || 0);
        existing.totalLeads += row.total_leads || 0;
        existing.daysWithData++;

        // Additional metrics
        existing.sessions += row.sessions || 0;
        existing.users += row.users || 0;
        existing.adsClicks += row.ads_clicks || 0;
        existing.adsImpressions += row.ads_impressions || 0;
        existing.gscClicks += row.seo_clicks || 0;
        existing.gscImpressions += row.seo_impressions || 0;
        existing.gbpClicks += row.gbp_website_clicks || 0;
        existing.gbpViews += row.gbp_profile_views || 0;

        // Average Google Rank across days
        if (row.google_rank !== null) {
          if (existing.googleRank === null) {
            existing.googleRank = row.google_rank;
          } else {
            existing.googleRank = (existing.googleRank + row.google_rank) / 2;
          }
        }
      }
    });

    // Calculate CPL from Google Ads conversions ONLY (not total leads)
    metricsMap.forEach((m) => {
      m.cpl = m.googleAdsConversions > 0 ? Math.round((m.adSpend / m.googleAdsConversions) * 100) / 100 : 0;
      m.adSpend = Math.round(m.adSpend * 100) / 100;
      if (m.googleRank !== null) {
        m.googleRank = Math.round(m.googleRank * 10) / 10;
      }
    });

    // Step 6: Build response with trend data
    const results = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {};

      const clientMetrics = metricsMap.get(client.id) || {
        googleAdsConversions: 0,
        adSpend: 0,
        formFills: 0,
        gbpCalls: 0,
        googleRank: null,
        topKeywords: 0,
        totalLeads: 0,
        cpl: 0,
        daysWithData: 0,
        sessions: 0,
        users: 0,
        adsClicks: 0,
        adsImpressions: 0,
        gscClicks: 0,
        gscImpressions: 0,
        gbpClicks: 0,
        gbpViews: 0,
      };

      // Calculate change percentage
      const prevLeads = prevLeadsMap.get(client.id) || 0;
      const currentLeads = clientMetrics.totalLeads;
      let leadsChange: number | null = null;
      if (prevLeads > 0) {
        leadsChange = Math.round(((currentLeads - prevLeads) / prevLeads) * 100);
      } else if (currentLeads > 0) {
        leadsChange = 100; // New leads from nothing
      }

      // Get sparkline data (pad to 7 days if needed)
      const sparkline = sparklineMap.get(client.id) || [];
      while (sparkline.length < 7) {
        sparkline.unshift(0); // Pad with zeros at beginning
      }

      // Determine status based on performance
      let status: 'excellent' | 'good' | 'watch' | 'critical' = 'good';
      if (clientMetrics.cpl > 100 || (currentLeads === 0 && clientMetrics.adSpend > 100)) {
        status = 'critical';
      } else if (leadsChange !== null && leadsChange < -20) {
        status = 'watch';
      } else if (leadsChange !== null && leadsChange > 15 && currentLeads > 10) {
        status = 'excellent';
      }

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        googleAdsConversions: clientMetrics.googleAdsConversions,
        formFills: clientMetrics.formFills,
        gbpCalls: clientMetrics.gbpCalls,
        adSpend: clientMetrics.adSpend,
        cpl: clientMetrics.cpl,
        googleRank: clientMetrics.googleRank,
        topKeywords: clientMetrics.topKeywords,
        totalLeads: clientMetrics.totalLeads,
        leadsChange,
        sparkline: sparkline.slice(-7), // Last 7 data points
        status,
        // Additional metrics from pre-computed data
        sessions: clientMetrics.sessions,
        users: clientMetrics.users,
        adsClicks: clientMetrics.adsClicks,
        adsImpressions: clientMetrics.adsImpressions,
        gscClicks: clientMetrics.gscClicks,
        gscImpressions: clientMetrics.gscImpressions,
        gbpClicks: clientMetrics.gbpClicks,
        gbpViews: clientMetrics.gbpViews,
        services: {
          googleAds: !!(config.gads_customer_id && config.gads_customer_id.trim()),
          seo: !!(config.gsc_site_url && config.gsc_site_url.trim()),
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false,
        },
      };
    });

    // Calculate summary stats
    const totalAdsConversions = results.reduce((sum, c) => sum + c.googleAdsConversions, 0);
    const summary = {
      totalClients: results.length,
      totalLeads: results.reduce((sum, c) => sum + c.totalLeads, 0),
      totalAdsConversions,
      totalSpend: Math.round(results.reduce((sum, c) => sum + c.adSpend, 0) * 100) / 100,
      avgCPL: 0,
      needsAttention: results.filter(c => c.status === 'critical' || c.status === 'watch').length,
      excellent: results.filter(c => c.status === 'excellent').length,
    };
    // CPL based on Google Ads conversions ONLY
    summary.avgCPL = totalAdsConversions > 0
      ? Math.round((summary.totalSpend / totalAdsConversions) * 100) / 100
      : 0;

    const duration = Date.now() - startTime;
    console.log(`⚡ [Overview Fast] Returned ${results.length} clients in ${duration}ms`);

    return NextResponse.json({
      success: true,
      clients: results,
      summary,
      preComputed: true,
      duration,
      dateRange: { startDate, endDate },
    });

  } catch (error: any) {
    console.error('[Overview Fast] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
