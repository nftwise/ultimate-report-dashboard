import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/alerts-data
 * Returns month-over-month data for the alerts widget (two most recent complete months).
 * The just-finished month is only used after the 5th, when its data has matured.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdminTeam();

    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Compare the two most recent COMPLETE calendar months. Both lead components
    // are retroactively revised by Google (Ads conversions land 1-7 days late,
    // GBP call counts trail views), so the just-finished month is only trusted
    // after the 5th: e.g. on Jun 11 we compare May vs Apr, but on Jun 3 May's
    // tail is still filling in, so we compare Apr vs Mar instead.
    const now = new Date();
    const monthsBack = now.getUTCDate() > 5 ? 1 : 2;
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const curStart = new Date(Date.UTC(y, m - monthsBack, 1));
    const curEnd = fmt(new Date(Date.UTC(y, m - monthsBack + 1, 0)));
    const prevStart = new Date(Date.UTC(y, m - monthsBack - 1, 1));
    const prevEnd = new Date(Date.UTC(y, m - monthsBack, 0));

    const [{ data: cur }, { data: prev }, { data: clients }] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, google_ads_conversions, gbp_calls, sessions')
        .eq('period_type', 'daily')
        .gte('date', fmt(curStart))
        .lte('date', curEnd),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, google_ads_conversions, gbp_calls, sessions')
        .eq('period_type', 'daily')
        .gte('date', fmt(prevStart))
        .lte('date', fmt(prevEnd)),
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
        cur: { from: fmt(curStart), to: curEnd },
        prev: { from: fmt(prevStart), to: fmt(prevEnd) },
      },
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
