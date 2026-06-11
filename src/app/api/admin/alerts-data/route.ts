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

    // Previous calendar month relative to today — the month admins should have
    // entered manual form fills for (the client dashboards display it).
    const fillMonthDate = new Date(Date.UTC(y, m - 1, 1));
    const fillMonth = `${fillMonthDate.getUTCFullYear()}-${String(fillMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    // Sync staleness: look at the trailing 14 days and find each client's last
    // day with GA4 sessions. Compared against the fleet's freshest day so a
    // global sync delay doesn't flag everyone.
    const recentStart = fmt(new Date(Date.UTC(y, m, now.getUTCDate() - 14)));

    const [{ data: cur }, { data: prev }, { data: clients }, { data: fillRows }, { data: recentRows }] = await Promise.all([
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
      supabaseAdmin
        .from('manual_form_fills')
        .select('client_id')
        .eq('year_month', fillMonth),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, date, sessions')
        .eq('period_type', 'daily')
        .gte('date', recentStart),
    ]);

    // Missing manual form fills for last month
    const filledSet = new Set((fillRows || []).map((r: any) => r.client_id));
    const missingFormFills = (clients || [])
      .filter((c: any) => !filledSet.has(c.id))
      .map((c: any) => ({ id: c.id, name: c.name }));

    // Stale GA4 sync: client's last sessions>0 day is 3+ days behind the fleet's freshest
    const lastGa4: Record<string, string> = {};
    let fleetMax = '';
    for (const r of (recentRows || []) as any[]) {
      if ((r.sessions || 0) > 0) {
        if (!lastGa4[r.client_id] || r.date > lastGa4[r.client_id]) lastGa4[r.client_id] = r.date;
        if (r.date > fleetMax) fleetMax = r.date;
      }
    }
    const staleSync = fleetMax
      ? (clients || [])
          .filter((c: any) => {
            const last = lastGa4[c.id];
            if (!last) return true; // no GA4 data in 14 days at all
            const diffDays = (Date.parse(fleetMax) - Date.parse(last)) / 86400000;
            return diffDays >= 3;
          })
          .map((c: any) => ({ id: c.id, name: c.name, lastDate: lastGa4[c.id] || null }))
      : [];

    return NextResponse.json({
      success: true,
      cur: cur || [],
      prev: prev || [],
      clients: clients || [],
      windows: {
        cur: { from: fmt(curStart), to: curEnd },
        prev: { from: fmt(prevStart), to: fmt(prevEnd) },
      },
      actionItems: {
        fillMonth,
        missingFormFills,
        staleSync,
      },
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
