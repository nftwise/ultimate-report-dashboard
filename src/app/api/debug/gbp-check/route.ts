import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPRange } from '@/lib/gbp-fetch-utils';

export const maxDuration = 60;

/**
 * GET /api/debug/gbp-check?slug=chirosolutions-center&start=2026-03-01&end=2026-03-31
 * Fetch GBP data from live API for a client + date range, compare with DB.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug  = request.nextUrl.searchParams.get('slug') || 'chirosolutions-center';
  const start = request.nextUrl.searchParams.get('start') || '2026-03-01';
  const end   = request.nextUrl.searchParams.get('end')   || '2026-03-31';

  // 1. Load client + location
  const { data: client } = await supabaseAdmin
    .from('clients').select('id, name').eq('slug', slug).single();
  if (!client) return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 });

  const { data: locs } = await supabaseAdmin
    .from('gbp_locations').select('gbp_location_id, location_name')
    .eq('client_id', client.id).eq('is_active', true);
  if (!locs?.length) return NextResponse.json({ error: 'No active GBP locations' }, { status: 404 });

  // 2. DB: read per-day from raw table
  const { data: rawRows } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls, views, website_clicks, direction_requests')
    .eq('client_id', client.id)
    .gte('date', start).lte('date', end)
    .order('date');

  const dbTotal = (rawRows || []).reduce((acc, r) => ({
    calls: acc.calls + (r.phone_calls || 0),
    views: acc.views + (r.views || 0),
    webClicks: acc.webClicks + (r.website_clicks || 0),
    directions: acc.directions + (r.direction_requests || 0),
  }), { calls: 0, views: 0, webClicks: 0, directions: 0 });

  // 3. Live GBP API: fetch entire month as a range (most accurate)
  const apiResults: any[] = [];
  for (const loc of locs) {
    try {
      const metrics = await fetchGBPRange(loc.gbp_location_id, start, end);
      apiResults.push({
        location: loc.location_name,
        locationId: loc.gbp_location_id,
        calls:      metrics.CALL_CLICKS      || 0,
        views:      (metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
                    (metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
                    (metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0) +
                    (metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0),
        webClicks:  metrics.WEBSITE_CLICKS   || 0,
        directions: metrics.BUSINESS_DIRECTION_REQUESTS || 0,
        raw: metrics,
      });
    } catch (e: any) {
      apiResults.push({ location: loc.location_name, error: e.message });
    }
  }

  const apiTotal = apiResults.reduce((acc, r) => ({
    calls:      acc.calls      + (r.calls      || 0),
    views:      acc.views      + (r.views      || 0),
    webClicks:  acc.webClicks  + (r.webClicks  || 0),
    directions: acc.directions + (r.directions || 0),
  }), { calls: 0, views: 0, webClicks: 0, directions: 0 });

  // 4. Diff
  const diff = {
    calls:      { db: dbTotal.calls,      api: apiTotal.calls,      delta: apiTotal.calls      - dbTotal.calls      },
    views:      { db: dbTotal.views,      api: apiTotal.views,      delta: apiTotal.views      - dbTotal.views      },
    webClicks:  { db: dbTotal.webClicks,  api: apiTotal.webClicks,  delta: apiTotal.webClicks  - dbTotal.webClicks  },
    directions: { db: dbTotal.directions, api: apiTotal.directions, delta: apiTotal.directions - dbTotal.directions },
  };

  return NextResponse.json({
    client: client.name,
    range: { start, end },
    db: { total: dbTotal, days: rawRows?.length, perDay: rawRows },
    api: { total: apiTotal, locations: apiResults },
    diff,
    match: Object.values(diff).every(d => d.delta === 0),
  });
}
