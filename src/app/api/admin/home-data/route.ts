import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/home-data[?from=...&to=...]
 *
 * No params: returns the latest available data date for the date picker anchor.
 * With from/to: returns clients + aggregated metrics + alerts data for the home page.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminTeam();

    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');

    // Bootstrap: just return the latest data date so the page can anchor the picker.
    if (!fromParam && !toParam) {
      const { data } = await supabaseAdmin
        .from('client_metrics_summary')
        .select('date')
        .eq('period_type', 'daily')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        lastAvailableDate: (data as any)?.date ?? null,
      });
    }

    const from = parseDateParam('from', fromParam);
    const to = parseDateParam('to', toParam);
    if (from > to) {
      return NextResponse.json({ success: false, error: '`from` must be <= `to`' }, { status: 400 });
    }

    // Previous period (same length, immediately before `from`)
    const fromDate = new Date(from + 'T12:00:00Z');
    const toDate = new Date(to + 'T12:00:00Z');
    const periodMs = toDate.getTime() - fromDate.getTime() + 86400000;
    const prevTo = new Date(fromDate.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - periodMs + 86400000);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const prevFromStr = fmt(prevFrom);
    const prevToStr = fmt(prevTo);

    // Manual fills: pick last N COMPLETE months relative to `to`
    const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
    const numFillMonths = periodDays > 35 ? 3 : 1;
    const rangeMonths: string[] = [];
    let cY = toDate.getUTCFullYear(), cM = toDate.getUTCMonth() + 1;
    let iter = 0;
    while (rangeMonths.length < numFillMonths && iter < 24) {
      const lastDay = new Date(Date.UTC(cY, cM, 0));
      if (lastDay <= toDate) rangeMonths.unshift(`${cY}-${String(cM).padStart(2, '0')}`);
      cM--; if (cM < 1) { cM = 12; cY--; }
      iter++;
    }
    if (rangeMonths.length === 0) {
      rangeMonths.push(`${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    const [
      { data: clients, error: clientsErr },
      { data: gbpRows },
      { data: latestGbpRow },
      { data: metricsRows },
      { data: formRows },
      { data: prevMetricsRows },
      { data: fillsRows },
    ] = await Promise.all([
      supabaseAdmin
        .from('clients')
        .select(`id, name, slug, city, contact_email, is_active, owner, has_ads, has_seo,
          service_configs (ga_property_id, gads_customer_id, gsc_site_url, callrail_account_id)`)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('gbp_locations')
        .select('client_id')
        .eq('is_active', true),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('date')
        .eq('period_type', 'daily')
        .gt('gbp_calls', 0)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads, google_ads_conversions, gbp_calls, ad_spend, top_keywords, date')
        .gte('date', from)
        .lte('date', to)
        .eq('period_type', 'daily'),
      supabaseAdmin
        .from('ga4_events')
        .select('client_id, event_count')
        .gte('date', from)
        .lte('date', to)
        .ilike('event_name', '%success%'),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads')
        .gte('date', prevFromStr)
        .lte('date', prevToStr)
        .eq('period_type', 'daily'),
      supabaseAdmin
        .from('manual_form_fills')
        .select('client_id, year_month, form_fills')
        .in('year_month', rangeMonths),
    ]);

    if (clientsErr) {
      return NextResponse.json({ success: false, error: clientsErr.message }, { status: 500 });
    }

    const completeCutoff = (latestGbpRow as any)?.date || to;

    return NextResponse.json({
      success: true,
      clients: clients || [],
      gbpClientIds: (gbpRows || []).map((r: any) => r.client_id),
      completeCutoff,
      currMetrics: metricsRows || [],
      formEvents: formRows || [],
      prevMetrics: prevMetricsRows || [],
      manualFills: fillsRows || [],
      prevRange: { from: prevFromStr, to: prevToStr },
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
