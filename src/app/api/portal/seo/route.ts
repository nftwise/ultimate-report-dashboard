import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, authorizeClientId, parseDateParam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/seo?clientId=X[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Without from/to: bootstrap (lastAvailableDate only).
 * With from/to: full payload — daily metrics, keyword ranks, prev period, movement, real conversions.
 *
 * Auth: client role can only request their own clientId; admin/team can request any.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const clientId = authorizeClientId(session, request.nextUrl.searchParams.get('clientId') || '');

    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');

    const lastAvailableDate = await fetchLastAvailableDate(clientId);

    if (!fromParam && !toParam) {
      return NextResponse.json({ success: true, lastAvailableDate });
    }

    const from = parseDateParam('from', fromParam);
    const to = parseDateParam('to', toParam);
    if (from > to) {
      return NextResponse.json({ success: false, error: '`from` must be <= `to`' }, { status: 400 });
    }
    const prev = computePreviousPeriod(from, to);

    const [
      { data: dailyRows, error: dailyErr },
      { data: latestKwRow },
      { data: gscDailyRow },
      { data: gscRangeRows },
      { data: prevGscRows },
      { data: prevMetricsRows },
      { data: convRows },
    ] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select(
          'date, sessions, users, new_users, returning_users, sessions_desktop, sessions_mobile, blog_sessions, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, seo_impressions, seo_clicks, seo_ctr, google_rank, engagement_rate, conversion_rate, top_keywords'
        )
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true }),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('top_keywords')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('gsc_daily_summary')
        .select('top_keywords_count')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('gsc_queries')
        .select('query, position')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to),
      supabaseAdmin
        .from('gsc_queries')
        .select('query, position')
        .eq('client_id', clientId)
        .gte('date', prev.from)
        .lte('date', prev.to),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('sessions, users, seo_impressions, seo_clicks, traffic_organic')
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', prev.from)
        .lte('date', prev.to),
      supabaseAdmin
        .from('ga4_events')
        .select('event_count')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .in('event_name', ['submit_form_successful', 'Appointment_Successful', 'call_from_web']),
    ]);

    if (dailyErr) {
      return NextResponse.json({ success: false, error: dailyErr.message }, { status: 500 });
    }

    // Keyword rank buckets
    const accurateTop10 = (gscDailyRow?.[0] as any)?.top_keywords_count || 0;
    const keywordRankBuckets = computeRankBuckets(gscRangeRows || [], accurateTop10);

    // Keyword movement (improved/declined)
    const keywordMovement = computeKeywordMovement(prevGscRows || [], gscRangeRows || []);

    // Previous period aggregates
    const prevSessions = sumField(prevMetricsRows, 'sessions');
    const prevUsers = sumField(prevMetricsRows, 'users');
    const prevSeoClicks = sumField(prevMetricsRows, 'seo_clicks');
    const prevOrganicVisits = sumField(prevMetricsRows, 'traffic_organic');
    const prevImpressions = sumField(prevMetricsRows, 'seo_impressions');
    const prevPeriod = {
      sessions: prevSessions,
      users: prevUsers,
      ctr: prevImpressions > 0 ? (prevSeoClicks / prevImpressions) * 100 : 0,
      seoClicks: prevSeoClicks,
      organicVisits: prevOrganicVisits,
    };

    const realConversions = (convRows || []).reduce(
      (s: number, r: any) => s + (r.event_count || 0),
      0
    );

    return NextResponse.json({
      success: true,
      lastAvailableDate,
      daily: dailyRows || [],
      topKeywords: (latestKwRow?.[0] as any)?.top_keywords || null,
      keywordRankBuckets,
      keywordMovement,
      prevPeriod,
      realConversions,
      prevRange: prev,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('[/api/portal/seo]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
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

function sumField(rows: any[] | null | undefined, field: string): number {
  return (rows || []).reduce((s, r) => s + (r[field] || 0), 0);
}

function computeRankBuckets(rows: any[], accurateTop10: number) {
  if (!rows.length) return { top5: 0, top10: accurateTop10, top11to20: 0 };
  const best = new Map<string, number>();
  for (const row of rows) {
    const q = (row.query || '').toLowerCase();
    const pos = row.position || 999;
    if (!best.has(q) || pos < best.get(q)!) best.set(q, pos);
  }
  let top5 = 0, top10 = 0, top11to20 = 0;
  for (const pos of best.values()) {
    if (pos <= 5) top5++;
    if (pos <= 10) top10++;
    else if (pos <= 20) top11to20++;
  }
  return { top5, top10: accurateTop10 || top10, top11to20 };
}

function computeKeywordMovement(prevRows: any[], currRows: any[]) {
  const avgPos = (rows: any[]) => {
    const map = new Map<string, number[]>();
    for (const r of rows) {
      const q = (r.query || '').toLowerCase();
      if (!map.has(q)) map.set(q, []);
      map.get(q)!.push(r.position || 999);
    }
    const result = new Map<string, number>();
    for (const [q, positions] of map) {
      result.set(q, positions.reduce((a, b) => a + b, 0) / positions.length);
    }
    return result;
  };
  const prevAvg = avgPos(prevRows);
  const currAvg = avgPos(currRows);
  let improved = 0, declined = 0;
  for (const [query, currPos] of currAvg) {
    const prevPos = prevAvg.get(query);
    if (prevPos !== undefined) {
      if (prevPos > currPos + 0.5) improved++;
      else if (currPos > prevPos + 0.5) declined++;
    }
  }
  return { improved, declined };
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
