import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { GBPTokenManager } from '@/lib/gbp-token-manager';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const TIMEOUT_MS = 20000;

// GBP Performance API metric names (GET method only)
// Note: ACTIONS_PHONE is NOT available via this API (returns 400/404)
// CALL_CLICKS = clicks on "Call" button on GBP listing (best available metric)
const METRICS = [
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];

/**
 * GET /api/cron/sync-gbp
 * Daily cron: Sync yesterday's GBP data to gbp_location_daily_metrics
 * Auth: OAuth via GBPTokenManager (reads refresh_token from Supabase system_settings)
 * Schedule: 12 10 * * * (2:12 AM PST = 10:12 UTC)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const dateParam = request.nextUrl.searchParams.get('date');
    const targetDate = dateParam || (() => {
      // Use California timezone for "yesterday" calculation
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();

    console.log(`[sync-gbp] Starting for ${targetDate}`);

    // Step 1: Get access token (auto-refreshes if expired, reads from Supabase)
    const accessToken = await GBPTokenManager.getAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No GBP OAuth token found. Run manual OAuth setup at /admin/google-business-setup first.',
      }, { status: 500 });
    }

    // Step 2: Get all active GBP locations with their client IDs
    const { data: locations, error: locError } = await supabaseAdmin
      .from('gbp_locations')
      .select('id, client_id, gbp_location_id, location_name')
      .eq('is_active', true);

    if (locError) throw new Error(`Failed to fetch GBP locations: ${locError.message}`);

    const validLocations = (locations || []).filter(l => l.gbp_location_id);
    console.log(`[sync-gbp] Processing ${validLocations.length} locations`);

    let synced = 0;
    const errors: string[] = [];

    // Step 3: Process in batches of 3
    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (location) => {
        try {
          const metrics = await fetchLocationMetrics(accessToken, location.gbp_location_id, targetDate);

          const row = {
            location_id: location.id,
            client_id: location.client_id,
            date: targetDate,
            // Profile views = all impressions combined
            views: metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS
              + metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS
              + metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH
              + metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
            // Actions total
            actions: metrics.WEBSITE_CLICKS + metrics.BUSINESS_DIRECTION_REQUESTS + metrics.CALL_CLICKS,
            direction_requests: metrics.BUSINESS_DIRECTION_REQUESTS,
            phone_calls: metrics.CALL_CLICKS,
            website_clicks: metrics.WEBSITE_CLICKS,
          };

          const { error } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .upsert(row, { onConflict: 'location_id,date' });

          if (error) {
            console.log(`[sync-gbp] Upsert error ${location.location_name}:`, error.message);
          }

          console.log(`[sync-gbp] ${location.location_name}: views=${row.views}, calls=${row.phone_calls}, clicks=${row.website_clicks}, directions=${row.direction_requests}`);
          return 1;
        } catch (err: any) {
          errors.push(`${location.location_name}: ${err.message}`);
          return 0;
        }
      }));

      synced += results.reduce((sum: number, r: number) => sum + r, 0);
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-gbp] Done in ${duration}ms: ${synced}/${validLocations.length} locations synced`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      locations: validLocations.length,
      synced,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });

  } catch (error: any) {
    console.error('[sync-gbp] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// GBP PERFORMANCE API HELPERS
// =====================================================

/**
 * Fetch all metrics for a single location on a given date.
 * Uses GET with query params (GBP Performance API v1 requirement).
 * Location ID is normalized to "locations/XXX" format.
 */
async function fetchLocationMetrics(
  accessToken: string,
  rawLocationId: string,
  date: string
): Promise<Record<string, number>> {
  // Normalize to "locations/XXX" format
  let locationId = rawLocationId;
  if (locationId.includes('/locations/')) {
    locationId = `locations/${locationId.split('/locations/')[1]}`;
  } else if (!locationId.startsWith('locations/')) {
    locationId = `locations/${locationId}`;
  }

  const [year, month, day] = date.split('-').map(Number);
  const results: Record<string, number> = {};

  // Initialize all metrics to 0
  for (const metric of METRICS) results[metric] = 0;

  await Promise.all(
    METRICS.map(async (metric) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        // GBP Performance API uses GET with query params
        const url = new URL(
          `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
        );
        url.searchParams.set('dailyMetric', metric);
        url.searchParams.set('dailyRange.start_date.year', String(year));
        url.searchParams.set('dailyRange.start_date.month', String(month));
        url.searchParams.set('dailyRange.start_date.day', String(day));
        url.searchParams.set('dailyRange.end_date.year', String(year));
        url.searchParams.set('dailyRange.end_date.month', String(month));
        url.searchParams.set('dailyRange.end_date.day', String(day));

        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return;

        const data = await response.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum: number, d: any) => sum + (parseInt(d.value || '0') || 0), 0);

        results[metric] = value;
      } catch {
        results[metric] = 0;
      }
    })
  );

  return results;
}
