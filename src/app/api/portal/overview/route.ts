import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, authorizeClientId, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/overview?clientId=X[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Returns the data needed by the client overview page in a single round trip.
 * - Without from/to: returns bootstrap data only (lastAvailableDate + latestGbpRating)
 * - With from/to: returns full payload (daily metrics + previous period + manual fills)
 *
 * Auth: client role can only request their own clientId; admin/team can request any.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const requestedClientId = request.nextUrl.searchParams.get('clientId') || '';
    const clientId = authorizeClientId(session, requestedClientId);

    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');

    // ── Bootstrap data (always returned) ──────────────────────────────────
    // Different data sources lag by different amounts (GA4 is freshest, GBP can
    // be 2-4 days behind). If we ended the window on the freshest source's last
    // day, the trailing days would be zero for the lagging source, making its
    // period-over-period comparison show a fake drop. So we compute the last day
    // that has data PER SOURCE and use the EARLIEST of them — the window then
    // ends where every source the client uses is complete.
    const lastDateWhere = (filter: (q: any) => any) =>
      filter(
        supabaseAdmin
          .from('client_metrics_summary')
          .select('date')
          .eq('client_id', clientId)
          .eq('period_type', 'daily')
      )
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r: any) => (r.data as any)?.date ?? null);

    // GA4 (sessions), GSC (impressions) and GBP (views/calls) are checked: all
    // three produce data every day for an active client, so a trailing zero
    // means "not synced yet". Ads are deliberately excluded — ad_spend of 0 is
    // a legitimate value (paused campaign), so it must not drag the window back
    // for non-spending clients.
    const [lastAny, lastGa4, lastGsc, lastGbp, latestGbpRating] = await Promise.all([
      lastDateWhere((q) => q),
      lastDateWhere((q) => q.gt('sessions', 0)),
      lastDateWhere((q) => q.gt('seo_impressions', 0)),
      lastDateWhere((q) => q.or('gbp_calls.gt.0,gbp_profile_views.gt.0,gbp_website_clicks.gt.0,gbp_directions.gt.0')),
      fetchLatestGbpRating(clientId),
    ]);

    // Earliest of the per-source last days (ISO date strings sort correctly).
    // Ignore sources the client has never had data for (null). Fall back to the
    // overall last row if somehow no source matched.
    const sourceLastDays = [lastGa4, lastGsc, lastGbp].filter(Boolean) as string[];
    const latestRow = sourceLastDays.length
      ? sourceLastDays.reduce((min, d) => (d < min ? d : min))
      : lastAny;

    if (!fromParam && !toParam) {
      return NextResponse.json({
        success: true,
        lastAvailableDate: latestRow,
        latestGbpRating,
      });
    }

    // ── Full payload (date range provided) ────────────────────────────────
    const from = parseDateParam('from', fromParam);
    const to = parseDateParam('to', toParam);

    if (from > to) {
      return NextResponse.json(
        { success: false, error: '`from` must be <= `to`' },
        { status: 400 }
      );
    }

    // Compute previous period in CALIFORNIA-LOCAL terms by parsing date strings.
    // Avoids the toISOString() UTC drift bug present in the old browser code.
    const prev = computePreviousPeriod(from, to);

    // Form Fills are entered manually per CALENDAR MONTH. The card always shows
    // the PREVIOUS complete calendar month relative to the window end (e.g. when
    // the window is in June, it shows all of May), compared to the month before.
    const addMonths = (ym: string, delta: number) => {
      const [y, m] = ym.split('-').map(Number);
      const idx = y * 12 + (m - 1) + delta;
      const ny = Math.floor(idx / 12);
      const nm = (idx % 12) + 1;
      return `${ny}-${String(nm).padStart(2, '0')}`;
    };
    const formFillMonth = addMonths(to.slice(0, 7), -1);     // previous calendar month
    const formFillPrevMonth = addMonths(to.slice(0, 7), -2); // the month before that

    const [
      { data: dailyData, error: dailyErr },
      { data: manualFills },
      { data: prevMetrics },
      { data: prevGbp },
    ] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select(`date, total_leads, form_fills, gbp_calls, gbp_profile_views,
          gbp_website_clicks, gbp_directions, google_ads_conversions, sessions,
          seo_impressions, seo_clicks, seo_ctr, traffic_organic, traffic_paid,
          traffic_direct, traffic_referral, traffic_ai, ads_impressions, ads_clicks,
          ads_ctr, ad_spend, cpl, budget_utilization`)
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true }),
      // Fetch exactly the two target months (previous calendar month + the one
      // before it) for the Form Fills card's month-over-month comparison.
      supabaseAdmin
        .from('manual_form_fills')
        .select('year_month, form_fills')
        .eq('client_id', clientId)
        .in('year_month', [formFillMonth, formFillPrevMonth]),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('total_leads, sessions, ad_spend, google_ads_conversions, seo_clicks, gbp_calls, form_fills')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', prev.from)
        .lte('date', prev.to),
      supabaseAdmin
        .from('gbp_location_daily_metrics')
        .select('phone_calls')
        .eq('client_id', clientId)
        .gte('date', prev.from)
        .lte('date', prev.to),
    ]);

    if (dailyErr) {
      return NextResponse.json(
        { success: false, error: dailyErr.message },
        { status: 500 }
      );
    }

    const daily = (dailyData || []).map((m: any) => ({
      ...m,
      gbp_profile_views: m.gbp_profile_views ?? 0,
      gbp_website_clicks: m.gbp_website_clicks ?? 0,
      gbp_direction_requests: m.gbp_directions ?? 0,
    }));

    // Map the two fetched rows by month, then pick the fixed target months.
    const manualByMonth = new Map(
      ((manualFills || []) as Array<{ year_month: string; form_fills: number }>).map(
        (r) => [r.year_month, r.form_fills ?? 0]
      )
    );
    const manualFormFills = manualByMonth.get(formFillMonth) ?? 0;
    const manualFormFillsMonth = formFillMonth;
    const manualFormFillsPrev = manualByMonth.get(formFillPrevMonth) ?? 0;
    const manualFormFillsPrevMonth = formFillPrevMonth;
    // Whether the admin has actually entered the target month — distinct from a
    // value of 0 (a verified "zero form fills" is a real, entered value and
    // must not fall back to raw GA4 events).
    const manualFormFillsEntered = manualByMonth.has(formFillMonth);

    const prevPeriod = {
      leads: sumField(prevMetrics, 'total_leads'),
      sessions: sumField(prevMetrics, 'sessions'),
      adSpend: sumField(prevMetrics, 'ad_spend'),
      adsCv: sumField(prevMetrics, 'google_ads_conversions'),
      seoClicks: sumField(prevMetrics, 'seo_clicks'),
      gbpCalls:
        sumField(prevGbp, 'phone_calls') || sumField(prevMetrics, 'gbp_calls'),
      formFills: sumField(prevMetrics, 'form_fills'),
    };

    return NextResponse.json({
      success: true,
      lastAvailableDate: latestRow,
      latestGbpRating,
      daily,
      manualFormFills,
      manualFormFillsEntered,
      manualFormFillsMonth,
      manualFormFillsPrev,
      manualFormFillsPrevMonth,
      prevPeriod,
      prevRange: prev,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error('[/api/portal/overview]', err);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

async function fetchLatestGbpRating(clientId: string): Promise<number> {
  const { data: gbpRow } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('average_rating')
    .eq('client_id', clientId)
    .gt('average_rating', 0)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if ((gbpRow as any)?.average_rating > 0) return (gbpRow as any).average_rating;

  const { data: summaryRow } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('gbp_rating_avg')
    .eq('client_id', clientId)
    .eq('period_type', 'daily')
    .gt('gbp_rating_avg', 0)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (summaryRow as any)?.gbp_rating_avg ?? 0;
}

function sumField(rows: any[] | null | undefined, field: string): number {
  return (rows || []).reduce((s, r) => s + (r[field] || 0), 0);
}

/**
 * Given a date range [from, to], return the immediately preceding range of the
 * same length, computed by string math (no Date timezone drift).
 */
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
