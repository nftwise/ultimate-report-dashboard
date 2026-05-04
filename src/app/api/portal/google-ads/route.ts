import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, authorizeClientId, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/google-ads?clientId=X[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Without from/to: bootstrap (lastAvailableDate from ads_campaign_metrics).
 * With from/to: full payload — daily aggregated + campaigns + ad groups + search terms +
 *               conversion breakdown + total conversions + prev period.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const clientId = authorizeClientId(session, request.nextUrl.searchParams.get('clientId') || '');

    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');

    if (!fromParam && !toParam) {
      const lastAvailableDate = await fetchLastAdsDate(clientId);
      return NextResponse.json({ success: true, lastAvailableDate });
    }

    const from = parseDateParam('from', fromParam);
    const to = parseDateParam('to', toParam);
    if (from > to) {
      return NextResponse.json({ success: false, error: '`from` must be <= `to`' }, { status: 400 });
    }
    const prev = computePreviousPeriod(from, to);

    const [
      { data: campaignDaily, error: campErr },
      { data: summaryRows },
      { data: searchTerms },
      { data: campaignAgg },
      { data: adGroupRows },
      { data: conversionActions },
      { data: prevCampaign },
    ] = await Promise.all([
      supabaseAdmin
        .from('ads_campaign_metrics')
        .select('date, impressions, clicks, cost, conversions')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true }),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('date, sessions_mobile, sessions_desktop, total_leads')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('campaign_search_terms')
        .select('search_term, impressions, clicks, cost, conversions')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('ads_campaign_metrics')
        .select('campaign_id, campaign_name, cost, conversions')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('ads_ad_group_metrics')
        .select('campaign_id, ad_group_id, ad_group_name, impressions, clicks, cost, conversions')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('campaign_conversion_actions')
        .select('conversions, conversion_action_name')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('ads_campaign_metrics')
        .select('impressions, clicks, cost, conversions')
        .eq('client_id', clientId)
        .gte('date', prev.from)
        .lte('date', prev.to),
    ]);

    if (campErr) {
      return NextResponse.json({ success: false, error: campErr.message }, { status: 500 });
    }

    const daily = aggregateDaily(campaignDaily || [], summaryRows || []);
    const totalConversions = Math.round(
      (campaignDaily || []).reduce((s: number, r: any) => s + (r.conversions || 0), 0)
    );

    const prevTotals = sumCampaignTotals(prevCampaign || []);

    return NextResponse.json({
      success: true,
      daily,
      campaigns: campaignAgg || [],
      adGroups: adGroupRows || [],
      searchTerms: searchTerms || [],
      conversionActions: conversionActions || [],
      totalConversions,
      prevPeriod: prevTotals,
      prevRange: prev,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('[/api/portal/google-ads]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

async function fetchLastAdsDate(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('ads_campaign_metrics')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any)?.date ?? null;
}

function aggregateDaily(campaignRows: any[], summaryRows: any[]) {
  const deviceByDate = new Map<string, { mobile: number; desktop: number; leads: number }>();
  for (const row of summaryRows) {
    deviceByDate.set(row.date, {
      mobile: row.sessions_mobile || 0,
      desktop: row.sessions_desktop || 0,
      leads: row.total_leads || 0,
    });
  }

  const dateMap = new Map<string, any>();
  for (const row of campaignRows) {
    const date = row.date;
    if (!dateMap.has(date)) {
      const dev = deviceByDate.get(date) || { mobile: 0, desktop: 0, leads: 0 };
      dateMap.set(date, {
        date,
        ads_impressions: 0,
        ads_clicks: 0,
        ads_ctr: 0,
        ad_spend: 0,
        cpl: 0,
        google_ads_conversions: 0,
        total_leads: dev.leads,
        sessions_mobile: dev.mobile,
        sessions_desktop: dev.desktop,
      });
    }
    const entry = dateMap.get(date);
    entry.ads_impressions += row.impressions || 0;
    entry.ads_clicks += row.clicks || 0;
    entry.ad_spend += row.cost || 0;
    entry.google_ads_conversions += row.conversions || 0;
  }

  const out = Array.from(dateMap.values());
  for (const d of out) {
    d.ads_ctr = d.ads_impressions > 0 ? (d.ads_clicks / d.ads_impressions) * 100 : 0;
    d.cpl = d.google_ads_conversions > 0 ? d.ad_spend / d.google_ads_conversions : 0;
  }
  return out;
}

function sumCampaignTotals(rows: any[]) {
  return {
    spend:       rows.reduce((s, r) => s + (r.cost || 0), 0),
    clicks:      rows.reduce((s, r) => s + (r.clicks || 0), 0),
    impressions: rows.reduce((s, r) => s + (r.impressions || 0), 0),
    conversions: rows.reduce((s, r) => s + (r.conversions || 0), 0),
  };
}

function computePreviousPeriod(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T12:00:00Z');
  const toDate = new Date(to + 'T12:00:00Z');
  const periodMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo.getTime() - periodMs);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}
