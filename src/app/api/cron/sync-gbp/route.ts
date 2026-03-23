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

    // If a specific date is requested, use it. Otherwise sync the last 30 days.
    // 30 days (up from 20) ensures even long GBP API lags (observed up to 16d) are captured:
    // dates that showed 0 when first synced get corrected when Google finalizes the data.
    const datesToSync: string[] = dateParam ? [dateParam] : (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dates: string[] = [];
      for (let i = 1; i <= 30; i++) {
        const d = new Date(caToday);
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return dates;
    })();

    const targetDate = datesToSync[0]; // for backwards compat in response
    const clientIdParam = request.nextUrl.searchParams.get('clientId');
    console.log(`[sync-gbp] Starting for ${datesToSync.length > 1 ? `${datesToSync[datesToSync.length - 1]} to ${datesToSync[0]} (${datesToSync.length} days)` : targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

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

    let validLocations = (locations || []).filter(l => l.gbp_location_id);
    if (clientIdParam) {
      validLocations = validLocations.filter(l => l.client_id === clientIdParam);
      if (validLocations.length === 0) {
        return NextResponse.json({ success: false, error: `Client ${clientIdParam} not found or has no GBP location` }, { status: 404 });
      }
    }
    console.log(`[sync-gbp] Processing ${validLocations.length} locations`);

    let synced = 0;
    const errors: string[] = [];

    // Step 3: For each date, process all locations in batches of 3
    for (const syncDate of datesToSync) {
      console.log(`[sync-gbp] Processing date ${syncDate}`);

      for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
        const batch = validLocations.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(batch.map(async (location) => {
          const fetchWithRetry = async (fn: () => Promise<any>, label: string) => {
            try {
              return await fn();
            } catch (err: any) {
              console.log(`[sync-gbp] ${location.location_name} ${label} attempt 1 failed: ${err.message}, retrying...`);
              try {
                await new Promise(r => setTimeout(r, 2000));
                return await fn();
              } catch (err2: any) {
                console.log(`[sync-gbp] ${location.location_name} ${label} attempt 2 failed: ${err2.message}`);
                throw err2;
              }
            }
          };

          try {
            const metrics = await fetchWithRetry(() => fetchLocationMetrics(accessToken, location.gbp_location_id, syncDate), 'metrics');

            const row = {
              location_id: location.id,
              client_id: location.client_id,
              date: syncDate,
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

            // If API returned real data → full upsert (overwrite).
            // If API returned all zeros → only INSERT if no row exists yet;
            // never overwrite existing real data with zeros (GBP API can lag
            // 10-16 days before finalizing, returning 0 in the meantime).
            const hasData = row.phone_calls + row.website_clicks + row.direction_requests + row.views > 0;
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(row, {
                onConflict: 'location_id,date',
                ignoreDuplicates: !hasData,
              });

            if (error) {
              console.log(`[sync-gbp] Upsert error ${location.location_name}:`, error.message);
            }

            return 1;
          } catch (err: any) {
            errors.push(`${syncDate} ${location.location_name}: ${err.message}`);
            return 0;
          }
        }));

        synced += results.reduce((sum: number, r: number) => sum + r, 0);
      }
    }

    // ── Reviews snapshot (once per location, update most-recent date row) ───
    const gbpAccountId = process.env.GBP_ACCOUNT_ID;
    const mostRecentDate = datesToSync[0]; // first in list = most recent
    if (gbpAccountId) {
      console.log(`[sync-gbp] Syncing reviews for ${validLocations.length} locations...`);
      let reviewsSynced = 0;
      for (const location of validLocations) {
        try {
          const reviewData = await fetchLocationReviews(accessToken, gbpAccountId, location.gbp_location_id);
          if (reviewData) {
            await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .update({
                total_reviews: reviewData.totalReviewCount,
                average_rating: reviewData.averageRating,
              })
              .eq('location_id', location.id)
              .eq('date', mostRecentDate);
            reviewsSynced++;
          }
        } catch (err: any) {
          console.log(`[sync-gbp] Reviews fetch failed for ${location.location_name}:`, err.message);
        }
      }
      console.log(`[sync-gbp] Reviews synced for ${reviewsSynced}/${validLocations.length} locations`);
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-gbp] Done in ${duration}ms: ${synced}/${validLocations.length * datesToSync.length} location-days synced across ${datesToSync.length} dates`);

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
// GBP REVIEWS API HELPER
// =====================================================

/**
 * Fetch current review count and average rating for a location.
 * Uses mybusiness.googleapis.com v4 API (requires GBP_ACCOUNT_ID env var).
 * Returns null on failure (non-blocking — reviews are a bonus metric).
 */
async function fetchLocationReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
): Promise<{ totalReviewCount: number; averageRating: number } | null> {
  try {
    const url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?pageSize=1`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.totalReviewCount !== 'number' && !data.totalReviewCount) return null;
    return {
      totalReviewCount: Number(data.totalReviewCount) || 0,
      averageRating: Number(data.averageRating) || 0,
    };
  } catch {
    return null;
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
