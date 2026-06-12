import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, authorizeClientId, parseDateParam, PortalAuthError } from '@/lib/portal-auth';
import { JWT } from 'google-auth-library';

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
      { data: gscPrevRows },
      { data: prevMetricsRows },
      { data: convRows },
      { data: serviceConfig },
      { data: clientInfo },
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
        .select('position_buckets')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .not('position_buckets', 'is', null),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('sessions, users, seo_impressions, seo_clicks, traffic_organic, top_keywords')
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
      supabaseAdmin
        .from('service_configs')
        .select('gsc_site_url')
        .eq('client_id', clientId)
        .maybeSingle(),
      supabaseAdmin
        .from('clients')
        .select('name, city, slug')
        .eq('id', clientId)
        .maybeSingle(),
    ]);

    if (dailyErr) {
      return NextResponse.json({ success: false, error: dailyErr.message }, { status: 500 });
    }

    const siteUrl = (serviceConfig as any)?.gsc_site_url ?? null;
    let topKeywords: { kw: string; clicks: number; impressions: number; pos: number }[] | null = null;
    const _gscDebug: Record<string, any> = { siteUrl };

    if (siteUrl) {
      try {
        const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
        _gscDebug.hasKey = !!privateKey && privateKey.includes('-----BEGIN');
        _gscDebug.hasEmail = !!clientEmail;
        _gscDebug.keyLen = privateKey.length;
        if (privateKey && clientEmail) {
          const auth = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
          });
          const { token } = await auth.getAccessToken();
          _gscDebug.tokenOk = !!token;
          if (token) {
            const encodedSiteUrl = encodeURIComponent(siteUrl);
            const res = await fetch(
              `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startDate: from,
                  endDate: to,
                  dimensions: ['query'],
                  rowLimit: 5000,
                  dataState: 'all',
                }),
                signal: AbortSignal.timeout(15000),
              }
            );
            _gscDebug.gscStatus = res.status;
            if (res.ok) {
              const json = await res.json();
              _gscDebug.gscRows = json.rows?.length ?? 0;
              topKeywords = ((json.rows || []) as any[])
                .filter((r: any) =>
                  (r.clicks || 0) >= 1 ||
                  Math.round((r.position || 999) * 10) / 10 <= 10 ||
                  (r.impressions || 0) >= 50
                )
                .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
                .slice(0, 50)
                .map((r: any) => ({
                  kw: r.keys?.[0] || '',
                  clicks: r.clicks || 0,
                  impressions: r.impressions || 0,
                  pos: Math.round((r.position || 999) * 10) / 10,
                }));
            } else {
              _gscDebug.gscError = (await res.text()).slice(0, 300);
            }
          }
        }
      } catch (gscErr) {
        _gscDebug.gscException = (gscErr as any)?.message;
      }
    }

    // Fallback to DB cache if live GSC call failed or returned nothing
    if (!topKeywords || topKeywords.length === 0) {
      const { data: cachedRow } = await supabaseAdmin
        .from('gsc_daily_summary')
        .select('top_keywords_json')
        .eq('client_id', clientId)
        .gte('date', from)
        .lte('date', to)
        .not('top_keywords_json', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cachedRow && Array.isArray((cachedRow as any).top_keywords_json)) {
        topKeywords = (cachedRow as any).top_keywords_json;
      }
    }

    // Priority-sort keywords: brand > chiropractor+city > rest (within each group, sort by clicks desc)
    if (topKeywords && topKeywords.length > 0) {
      const name = ((clientInfo as any)?.name || '').toLowerCase();
      const city = ((clientInfo as any)?.city || '').split(',')[0].toLowerCase().trim();
      const slug = ((clientInfo as any)?.slug || '').toLowerCase();
      // Build brand tokens: words from clinic name + slug parts
      const brandTokens = [
        ...name.split(/\s+/).filter((w: string) => w.length > 3),
        ...slug.split('-').filter((w: string) => w.length > 3),
      ].filter(Boolean);

      const score = (kw: string): number => {
        const k = kw.toLowerCase();
        const hasCity = city && k.includes(city);
        const hasBrand = brandTokens.some((t: string) => k.includes(t));
        const hasChiro = k.includes('chiropractor') || k.includes('chiropractic') || k.includes('chiropractor');
        if (hasBrand && hasCity) return 3;        // brand + city = top
        if (hasBrand) return 2;                   // brand only
        if (hasChiro && hasCity) return 2;        // chiropractor + city
        if (hasChiro) return 1;                   // chiropractor generic
        return 0;
      };

      topKeywords = topKeywords.sort((a, b) => {
        const sd = score(b.kw) - score(a.kw);
        if (sd !== 0) return sd;
        return (b.clicks || 0) - (a.clicks || 0); // tie-break by clicks
      });
    }

    // Keyword rank buckets — use max across all days in period (most stable signal)
    const top10FromCms = (dailyRows || []).reduce((max: number, r: any) => Math.max(max, r.top_keywords || 0), 0);
    const totalRanking = ((gscPrevRows as any) || []).reduce(
      (max: number, r: any) => Math.max(max, (r.position_buckets as any)?.total ?? 0), 0
    );
    // Derive rank buckets from live GSC response when available, else fall back to DB
    const liveTop5 = topKeywords ? topKeywords.filter(k => k.pos <= 5).length : null;
    const liveTop10 = topKeywords ? topKeywords.filter(k => k.pos <= 10).length : null;
    const liveTop11to20 = topKeywords ? topKeywords.filter(k => k.pos > 10 && k.pos <= 20).length : null;
    const keywordRankBuckets = {
      top5:    liveTop5    ?? 0,
      top10:   liveTop10   ?? top10FromCms,
      top11to20: liveTop11to20 ?? 0,
      total:   totalRanking,
    };

    // Top 10 keyword count — max day in current vs prev period
    const currTop10 = (dailyRows || []).reduce((max: number, r: any) => Math.max(max, r.top_keywords || 0), 0);
    const prevTop10 = (prevMetricsRows || []).reduce((max: number, r: any) => Math.max(max, r.top_keywords || 0), 0);
    const keywordMovement = {
      improved: sumField(dailyRows, 'keywords_improved'),
      declined: sumField(dailyRows, 'keywords_declined'),
      currTop10,
      prevTop10,
      top10Change: prevTop10 > 0 ? currTop10 - prevTop10 : null,
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
      topKeywords,
      _gscDebug,
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
  // The SEO page mixes GA4 (fresh) and GSC (lags 2-3 days). Ending the window
  // on the freshest GA4 day leaves the GSC tail at zero and fakes a dip in
  // clicks/CTR, so end it on the earliest of the two sources' last data days.
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

  const [lastAny, lastGa4, lastGsc] = await Promise.all([
    lastDateWhere((q: any) => q),
    lastDateWhere((q: any) => q.gt('sessions', 0)),
    lastDateWhere((q: any) => q.gt('seo_impressions', 0)),
  ]);

  const sourceLastDays = [lastGa4, lastGsc].filter(Boolean) as string[];
  return sourceLastDays.length
    ? sourceLastDays.reduce((min, d) => (d < min ? d : min))
    : lastAny;
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
