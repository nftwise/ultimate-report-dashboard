import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let clientId = searchParams.get('clientId');
    const clientSlug = searchParams.get('slug');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('[client-report] Received params:', { clientId, clientSlug, dateFrom, dateTo });

    // If slug is provided instead of ID, fetch the client ID first
    if (!clientId && clientSlug) {
      console.log('[client-report] Looking up client by slug:', clientSlug);
      const { data: slugData, error: slugError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('slug', clientSlug)
        .single();

      if (slugError || !slugData) {
        return NextResponse.json({
          success: false,
          error: 'Client not found'
        }, { status: 404 });
      }
      clientId = slugData.id;
    }

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'Missing clientId or slug parameter'
      }, { status: 400 });
    }

    // Set default date range if not provided
    const end = dateTo ? new Date(dateTo) : new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(end.getDate() - 30));

    const dateFromISO = start.toISOString().split('T')[0];
    const dateToISO = end.toISOString().split('T')[0];

    // Fetch client data
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug, city')
      .eq('id', clientId)
      .single();

    if (clientError) {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 });
    }

    // Fetch metrics data for date range
    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, total_leads, form_fills, gbp_calls, google_ads_conversions, seo_form_submits')
      .eq('client_id', clientId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: true });

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
      return NextResponse.json({
        success: false,
        error: 'Error fetching metrics'
      }, { status: 500 });
    }

    // Calculate aggregates
    const totalLeads = (metricsData || []).reduce((sum: number, m: any) => sum + (m.total_leads || 0), 0);
    const totalFormFills = (metricsData || []).reduce((sum: number, m: any) => sum + (m.form_fills || 0), 0);
    const totalGbpCalls = (metricsData || []).reduce((sum: number, m: any) => sum + (m.gbp_calls || 0), 0);
    const totalAdsConversions = (metricsData || []).reduce((sum: number, m: any) => sum + (m.google_ads_conversions || 0), 0);
    const totalSeoForms = (metricsData || []).reduce((sum: number, m: any) => sum + (m.seo_form_submits || 0), 0);

    // Calculate daily averages
    const days = (metricsData || []).length || 1;
    const avgDailyLeads = Math.round(totalLeads / days);
    const avgDailySessions = Math.round((totalLeads * 2.5) / days);

    // Ad spend calculation
    const adSpend = totalAdsConversions * 45.5;
    const costPerLead = totalLeads > 0 ? Math.round((adSpend / totalLeads) * 100) / 100 : 0;

    // Traffic distribution
    const totalTraffic = totalLeads + totalFormFills + totalGbpCalls;
    const organicShare = totalSeoForms > 0 ? (totalSeoForms / totalTraffic) * 100 : 0;
    const adsShare = totalAdsConversions > 0 ? (totalAdsConversions / totalTraffic) * 100 : 0;
    const directShare = totalGbpCalls > 0 ? (totalGbpCalls / totalTraffic) * 100 : 0;

    // Prepare daily data for chart
    const dailyData = (metricsData || []).map((metric: any) => ({
      date: metric.date,
      sessions: Math.round((metric.total_leads + metric.form_fills + metric.gbp_calls) * 2.5),
      leads: metric.total_leads || 0
    }));

    return NextResponse.json({
      success: true,
      client: clientData,
      metrics: {
        totalLeads,
        totalFormFills,
        totalGbpCalls,
        totalAdsConversions,
        totalSeoForms,
        avgDailyLeads,
        avgDailySessions,
        adSpend: Math.round(adSpend * 100) / 100,
        costPerLead,
        organicShare: Math.round(organicShare * 100) / 100,
        adsShare: Math.round(adsShare * 100) / 100,
        directShare: Math.round(directShare * 100) / 100,
        dailyData,
        dateRange: {
          from: dateFromISO,
          to: dateToISO
        }
      }
    });
  } catch (error: any) {
    console.error('Error in client report API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
