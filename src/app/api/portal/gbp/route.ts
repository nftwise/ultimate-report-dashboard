import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, authorizeClientId, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/gbp?clientId=X[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Without from/to: bootstrap — locationName, lastAvailableDate, latestReviews,
 *                  latestRating, monthlyData (12-month rolling, independent of picker).
 * With from/to: period aggregates + previous period.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const clientId = authorizeClientId(session, request.nextUrl.searchParams.get('clientId') || '');

    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');

    if (!fromParam && !toParam) {
      // Bootstrap payload
      const [locationName, lastAvailableDate, reviewsBundle, monthlyData] = await Promise.all([
        fetchLocationName(clientId),
        fetchLastAvailableDate(clientId),
        fetchLatestReviews(clientId),
        fetch12MonthData(clientId),
      ]);

      return NextResponse.json({
        success: true,
        locationName,
        lastAvailableDate,
        latestReviews: reviewsBundle.reviews,
        latestRating: reviewsBundle.rating,
        monthlyData,
      });
    }

    const from = parseDateParam('from', fromParam);
    const to = parseDateParam('to', toParam);
    if (from > to) {
      return NextResponse.json({ success: false, error: '`from` must be <= `to`' }, { status: 400 });
    }
    const prev = computePreviousPeriod(from, to);

    const [{ data: curr, error: currErr }, { data: prevRows }] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions, gbp_reviews_new')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', prev.from)
        .lte('date', prev.to),
    ]);

    if (currErr) {
      return NextResponse.json({ success: false, error: currErr.message }, { status: 500 });
    }

    const period = aggregatePeriod(curr || []);
    const prevPeriod = aggregatePrev(prevRows || []);

    // Latest data date in current period (for staleness UI)
    const allDates = (curr || []).map((r: any) => r.date).sort();
    const lastGbpDataDate = allDates.length ? allDates[allDates.length - 1] : null;

    return NextResponse.json({
      success: true,
      period,
      prevPeriod,
      prevRange: prev,
      lastGbpDataDate,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('[/api/portal/gbp]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

async function fetchLocationName(clientId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('gbp_locations')
    .select('location_name')
    .eq('client_id', clientId)
    .maybeSingle();
  return (data as any)?.location_name || '';
}

async function fetchLastAvailableDate(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('date')
    .eq('client_id', clientId)
    .eq('period_type', 'daily')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any)?.date ?? null;
}

async function fetchLatestReviews(clientId: string): Promise<{ reviews: number; rating: number }> {
  const { data: detailed } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('total_reviews, average_rating')
    .eq('client_id', clientId)
    .gt('total_reviews', 0)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if ((detailed as any)?.total_reviews > 0) {
    return {
      reviews: (detailed as any).total_reviews,
      rating: (detailed as any).average_rating ?? 0,
    };
  }
  const { data: summary } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('gbp_reviews_count, gbp_rating_avg')
    .eq('client_id', clientId)
    .eq('period_type', 'daily')
    .gt('gbp_reviews_count', 0)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if ((summary as any)?.gbp_reviews_count > 0) {
    return {
      reviews: (summary as any).gbp_reviews_count,
      rating: (summary as any).gbp_rating_avg ?? 0,
    };
  }
  return { reviews: 0, rating: 0 };
}

async function fetch12MonthData(clientId: string) {
  const today = new Date();
  const lastCompleted = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth() - (11 - i), 1);
    const y = d.getFullYear(), m = d.getMonth();
    const lastDate = new Date(y, m + 1, 0);
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to: `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`,
    };
  });

  const overallFrom = months[0].from;
  const overallTo = months[11].to;

  const { data: rows } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('date, gbp_profile_views, gbp_calls, gbp_website_clicks, gbp_directions')
    .eq('client_id', clientId)
    .eq('period_type', 'daily')
    .gte('date', overallFrom)
    .lte('date', overallTo);

  const buckets = new Map<string, { views: number; calls: number; clicks: number; directions: number }>();
  months.forEach(m => buckets.set(m.key, { views: 0, calls: 0, clicks: 0, directions: 0 }));
  for (const r of (rows || []) as any[]) {
    const mk = (r.date as string).slice(0, 7);
    const b = buckets.get(mk);
    if (!b) continue;
    b.views += r.gbp_profile_views || 0;
    b.calls += r.gbp_calls || 0;
    b.clicks += r.gbp_website_clicks || 0;
    b.directions += r.gbp_directions || 0;
  }

  return {
    views: months.map(m => {
      const b = buckets.get(m.key)!;
      return { month: m.label, views: b.views, clicks: b.clicks, directions: b.directions };
    }),
    actions: months.map(m => ({ month: m.label, calls: buckets.get(m.key)!.calls })),
  };
}

function aggregatePeriod(rows: any[]) {
  let views = 0, calls = 0, clicks = 0, directions = 0, newReviews = 0, dataRows = 0;
  for (const r of rows) {
    const v = r.gbp_profile_views || 0;
    const c = r.gbp_calls || 0;
    const cl = r.gbp_website_clicks || 0;
    const dir = r.gbp_directions || 0;
    if (v === 0 && c === 0 && cl === 0 && dir === 0) continue;
    views += v; calls += c; clicks += cl; directions += dir;
    newReviews += r.gbp_reviews_new || 0;
    dataRows++;
  }
  return {
    views, calls, clicks, directions,
    actions: calls + clicks + directions,
    newReviews,
    dataRows,
  };
}

function aggregatePrev(rows: any[]) {
  let views = 0, calls = 0, clicks = 0, directions = 0;
  for (const r of rows) {
    const v = r.gbp_profile_views || 0;
    const c = r.gbp_calls || 0;
    const cl = r.gbp_website_clicks || 0;
    const dir = r.gbp_directions || 0;
    if (v === 0 && c === 0 && cl === 0 && dir === 0) continue;
    views += v; calls += c; clicks += cl; directions += dir;
  }
  return { views, calls, clicks, directions };
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
