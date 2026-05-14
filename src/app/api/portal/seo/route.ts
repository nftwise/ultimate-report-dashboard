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
      { data: gscDailyRows },
      { data: prevMetricsRows },
      { data: convRows },
    ] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select(
          'date, sessions, users, new_users, returning_users, sessions_desktop, sessions_mobile, blog_sessions, traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai, seo_impressions, seo_clicks, seo_ctr, google_rank, engagement_rate, conversion_rate, top_keywords, keywords_improved, keywords_declined'
        )
        .eq('client_id', clientId)
        .eq('period_type', 'daily')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true }),
      supabaseAdmin
        .from('gsc_daily_summary')
        .select('position_buckets, top5_keywords_count, top_keywords_count, top11to20_keywords_count')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .limit(1),
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

    // Keyword rank buckets — prefer position_buckets jsonb, fallback to individual columns, then cms
    const gscLatest = (gscDailyRows as any)?.[0] || {};
    const pb = (gscLatest.position_buckets || {}) as Record<string, number>;
    const top10FromCms = (dailyRows || []).reduce((max: number, r: any) => Math.max(max, r.top_keywords || 0), 0);
    const keywordRankBuckets = {
      top5:    pb.top5    ?? gscLatest.top5_keywords_count    ?? 0,
      top10:   pb.top10   ?? gscLatest.top_keywords_count     ?? top10FromCms,
      top11to20: pb.top11_20 ?? gscLatest.top11to20_keywords_count ?? 0,
      total:   pb.total   ?? 0,
    };

    // Keyword movement — summed from client_metrics_summary daily rows
    const keywordMovement = {
      improved: sumField(dailyRows, 'keywords_improved'),
      declined: sumField(dailyRows, 'keywords_declined'),
    };

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
      topKeywords: null,
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
