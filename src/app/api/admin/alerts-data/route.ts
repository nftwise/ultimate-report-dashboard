import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/alerts-data
 * Returns the 7d-vs-prev-7d data needed by the alerts widget on the admin home page.
 * Anchors both windows to the latest date with confirmed GBP data.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdminTeam();

    const { data: latestGbp } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .eq('period_type', 'daily')
      .gt('gbp_calls', 0)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const cutoff = (latestGbp as any)?.date
      ? new Date((latestGbp as any).date + 'T12:00:00Z')
      : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 8); return d; })();
    const cur7End = (latestGbp as any)?.date || fmt(cutoff);
    const cur7Start = new Date(cutoff); cur7Start.setUTCDate(cutoff.getUTCDate() - 6);
    const prev7End = new Date(cutoff); prev7End.setUTCDate(cutoff.getUTCDate() - 7);
    const prev7Start = new Date(cutoff); prev7Start.setUTCDate(cutoff.getUTCDate() - 13);

    const [{ data: cur }, { data: prev }, { data: clients }] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, google_ads_conversions, gbp_calls, sessions')
        .eq('period_type', 'daily')
        .gte('date', fmt(cur7Start))
        .lte('date', cur7End),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, google_ads_conversions, gbp_calls, sessions')
        .eq('period_type', 'daily')
        .gte('date', fmt(prev7Start))
        .lte('date', fmt(prev7End)),
      supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('is_active', true),
    ]);

    return NextResponse.json({
      success: true,
      cur: cur || [],
      prev: prev || [],
      clients: clients || [],
      windows: {
        cur: { from: fmt(cur7Start), to: cur7End },
        prev: { from: fmt(prev7Start), to: fmt(prev7End) },
      },
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
