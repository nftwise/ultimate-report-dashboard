import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports-data?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns clients list + current/previous metrics + 90-day trend for the reports page.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminTeam();
    const from = parseDateParam('from', request.nextUrl.searchParams.get('from'));
    const to = parseDateParam('to', request.nextUrl.searchParams.get('to'));
    if (from > to) {
      return NextResponse.json({ success: false, error: '`from` must be <= `to`' }, { status: 400 });
    }

    // Previous period (same length, ending day before `from`)
    const fromDate = new Date(from + 'T12:00:00Z');
    const toDate = new Date(to + 'T12:00:00Z');
    const periodMs = toDate.getTime() - fromDate.getTime() + 86400000;
    const prevTo = new Date(fromDate.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - periodMs + 86400000);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const prevFromStr = fmt(prevFrom);
    const prevToStr = fmt(prevTo);

    const trendFromDate = new Date();
    trendFromDate.setDate(trendFromDate.getDate() - 90);
    const trendFromStr = `${trendFromDate.getFullYear()}-${String(trendFromDate.getMonth() + 1).padStart(2, '0')}-${String(trendFromDate.getDate()).padStart(2, '0')}`;

    const [
      { data: clients, error: clientsErr },
      { data: currMetrics },
      { data: prevMetrics },
      { data: trendData },
    ] = await Promise.all([
      supabaseAdmin
        .from('clients')
        .select('id, name, slug, city, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads, gbp_calls, sessions, ad_spend, google_ads_conversions, fb_spend, fb_leads')
        .gte('date', from)
        .lte('date', to)
        .eq('period_type', 'daily'),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads, gbp_calls, sessions, ad_spend, google_ads_conversions, fb_spend, fb_leads')
        .gte('date', prevFromStr)
        .lte('date', prevToStr)
        .eq('period_type', 'daily'),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('date, total_leads, gbp_calls, sessions')
        .gte('date', trendFromStr)
        .lte('date', to)
        .eq('period_type', 'daily')
        .order('date', { ascending: true }),
    ]);

    if (clientsErr) {
      return NextResponse.json({ success: false, error: clientsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      clients: clients || [],
      currMetrics: currMetrics || [],
      prevMetrics: prevMetrics || [],
      trendData: trendData || [],
      prevRange: { from: prevFromStr, to: prevToStr },
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
