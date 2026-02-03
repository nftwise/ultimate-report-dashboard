import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('[daily-traffic] Request params:', { clientId, dateFrom, dateTo });

    if (!clientId || !dateFrom || !dateTo) {
      console.error('[daily-traffic] Missing parameters');
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: clientId, dateFrom, dateTo'
      }, { status: 400 });
    }

    // Fetch daily metrics for the client within the date range
    const { data, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select(`
        date,
        total_leads,
        form_fills,
        gbp_calls,
        google_ads_conversions,
        sessions,
        seo_impressions,
        seo_clicks,
        seo_ctr,
        traffic_organic,
        traffic_paid,
        traffic_direct,
        traffic_referral,
        traffic_ai,
        ads_impressions,
        ads_clicks,
        ads_ctr,
        ads_spend,
        cpl,
        health_score,
        budget_utilization
      `)
      .eq('client_id', clientId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (error) {
      console.error('[daily-traffic] Supabase error:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('[daily-traffic] Query returned', data?.length || 0, 'records');

    if (!data || data.length === 0) {
      console.warn(`[daily-traffic] No data found for client ${clientId} between ${dateFrom} and ${dateTo}`);
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Transform data to include all available metrics
    const formattedData = (data || []).map((item: any) => ({
      date: item.date,
      total_leads: item.total_leads || 0,
      form_fills: item.form_fills || 0,
      gbp_calls: item.gbp_calls || 0,
      google_ads_conversions: item.google_ads_conversions || 0,
      sessions: item.sessions || 0,
      seo_impressions: item.seo_impressions || 0,
      seo_clicks: item.seo_clicks || 0,
      seo_ctr: item.seo_ctr || 0,
      traffic_organic: item.traffic_organic || 0,
      traffic_paid: item.traffic_paid || 0,
      traffic_direct: item.traffic_direct || 0,
      traffic_referral: item.traffic_referral || 0,
      traffic_ai: item.traffic_ai || 0,
      ads_impressions: item.ads_impressions || 0,
      ads_clicks: item.ads_clicks || 0,
      ads_ctr: item.ads_ctr || 0,
      ads_spend: item.ads_spend || 0,
      cpl: item.cpl || 0,
      health_score: item.health_score || 0,
      budget_utilization: item.budget_utilization || 0,
      // Legacy format for backward compatibility
      traffic: (item.total_leads || 0) + (item.form_fills || 0) + (item.gbp_calls || 0),
      leads: item.total_leads || 0
    }));

    console.log('[daily-traffic] Returning formatted data:', formattedData.length, 'records');
    return NextResponse.json({
      success: true,
      data: formattedData
    });
  } catch (error: any) {
    console.error('[daily-traffic] Error fetching daily traffic:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch daily traffic data'
    }, { status: 500 });
  }
}
