import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

/**
 * GET /api/facebook/hourly-metrics
 * Fetches hourly breakdown from Facebook Ads API for a client.
 *
 * Query params:
 *   clientId  - UUID (required)
 *   dateFrom  - YYYY-MM-DD (optional)
 *   dateTo    - YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 });
    }

    const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'FB_ADS_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    // Get fb_ad_account_id from service_configs
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(fb_ad_account_id)')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const cfg = Array.isArray(clientData.service_configs)
      ? clientData.service_configs[0]
      : clientData.service_configs;
    const adAccountId = cfg?.fb_ad_account_id;

    if (!adAccountId) {
      return NextResponse.json({ error: 'No FB ad account configured for this client' }, { status: 404 });
    }

    // Build date range for the FB API
    const now = new Date();
    const from = dateFrom || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = dateTo || now.toISOString().split('T')[0];

    const url = new URL(`https://graph.facebook.com/v21.0/act_${adAccountId}/insights`);
    url.searchParams.set('breakdowns', 'hourly_stats_aggregated_by_advertiser_time_zone');
    url.searchParams.set('fields', 'spend,impressions,clicks,actions');
    url.searchParams.set('time_range', JSON.stringify({ since: from, until: to }));
    url.searchParams.set('level', 'account');
    url.searchParams.set('limit', '100');
    url.searchParams.set('access_token', accessToken);

    const fbRes = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    const fbJson = await fbRes.json();

    if (fbJson.error) {
      console.error('[fb/hourly-metrics] FB API error:', fbJson.error);
      return NextResponse.json(
        { error: fbJson.error.message || 'Facebook API error' },
        { status: 502 }
      );
    }

    // Parse hourly data — FB returns one row per hour bucket
    const hourlyMap: Record<number, { hour: number; spend: number; impressions: number; clicks: number; leads: number }> = {};

    // Initialize all 24 hours
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: h, spend: 0, impressions: 0, clicks: 0, leads: 0 };
    }

    for (const row of fbJson.data || []) {
      // The hourly breakdown key is "hourly_stats_aggregated_by_advertiser_time_zone"
      // Value format: "00:00:00 - 00:59:59" or similar
      const hourStr = row.hourly_stats_aggregated_by_advertiser_time_zone;
      const hourMatch = hourStr?.match(/^(\d{2}):/);
      if (!hourMatch) continue;

      const hour = parseInt(hourMatch[1], 10);
      if (hour < 0 || hour > 23) continue;

      hourlyMap[hour].spend += parseFloat(row.spend || '0');
      hourlyMap[hour].impressions += parseInt(row.impressions || '0', 10);
      hourlyMap[hour].clicks += parseInt(row.clicks || '0', 10);

      // Extract leads from actions array
      const leadAction = (row.actions || []).find(
        (a: any) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
      );
      if (leadAction) {
        hourlyMap[hour].leads += parseInt(leadAction.value || '0', 10);
      }
    }

    // Handle pagination if needed
    let nextUrl = fbJson.paging?.next;
    while (nextUrl) {
      const pageRes = await fetch(nextUrl, { signal: AbortSignal.timeout(15000) });
      const pageJson = await pageRes.json();

      for (const row of pageJson.data || []) {
        const hourStr = row.hourly_stats_aggregated_by_advertiser_time_zone;
        const hourMatch = hourStr?.match(/^(\d{2}):/);
        if (!hourMatch) continue;

        const hour = parseInt(hourMatch[1], 10);
        if (hour < 0 || hour > 23) continue;

        hourlyMap[hour].spend += parseFloat(row.spend || '0');
        hourlyMap[hour].impressions += parseInt(row.impressions || '0', 10);
        hourlyMap[hour].clicks += parseInt(row.clicks || '0', 10);

        const leadAction = (row.actions || []).find(
          (a: any) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
        );
        if (leadAction) {
          hourlyMap[hour].leads += parseInt(leadAction.value || '0', 10);
        }
      }

      nextUrl = pageJson.paging?.next;
    }

    // Round spend values
    const result = Object.values(hourlyMap)
      .sort((a, b) => a.hour - b.hour)
      .map((h) => ({
        ...h,
        spend: Math.round(h.spend * 100) / 100,
      }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[fb/hourly-metrics GET] Exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
