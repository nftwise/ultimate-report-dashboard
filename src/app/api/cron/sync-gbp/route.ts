import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';
import { GBPTokenManager } from '@/lib/gbp-token-manager';
import { sendCronFailureAlert } from '@/lib/telegram';

export const maxDuration = 300;

const BATCH_SIZE = 3;

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

    // If a specific date is requested, use it. Otherwise sync the last 45 days.
    // 45 days ensures even worst-case GBP API lags (~20-30d) are captured:
    // dates that showed 0 when first synced get corrected when Google finalizes the data.
    const datesToSync: string[] = dateParam ? [dateParam] : (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dates: string[] = [];
      for (let i = 1; i <= 45; i++) {
        const d = new Date(caToday);
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return dates;
    })();
    const groupParam = request.nextUrl.searchParams.get('group');   // 'A' | 'B' | 'C'
    const clientIdParam = request.nextUrl.searchParams.get('clientId');

    const targetDate = datesToSync[0]; // for backwards compat in response
    console.log(`[sync-gbp] Starting for ${datesToSync.length > 1 ? `${datesToSync[datesToSync.length - 1]} to ${datesToSync[0]} (${datesToSync.length} days)` : targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    // Step 1: Verify GBP token exists (fetchGBPDay will handle token refresh)
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'gbp_agency_master')
      .single();

    if (tokenError) {
      console.error('[sync-gbp] Token lookup error:', tokenError.message);
      return NextResponse.json({
        success: false,
        error: `Token lookup failed: ${tokenError.message}`,
      }, { status: 500 });
    }

    if (!tokenData?.value) {
      console.error('[sync-gbp] No GBP token in system_settings');
      return NextResponse.json({
        success: false,
        error: 'No GBP OAuth token found. Run manual OAuth setup at /admin/google-business-setup first.',
      }, { status: 500 });
    }

    // Step 2: Get active GBP locations, filtered by group or clientId
    let clientIdsInGroup: string[] | null = null;
    if (clientIdParam) {
      clientIdsInGroup = [clientIdParam];
    } else if (groupParam) {
      const { data: groupClients } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('sync_group', groupParam)
        .eq('is_active', true);
      clientIdsInGroup = (groupClients || []).map((c: any) => c.id);
    }

    let locQuery = supabaseAdmin
      .from('gbp_locations')
      .select('id, client_id, gbp_location_id, location_name')
      .eq('is_active', true);
    if (clientIdsInGroup) locQuery = locQuery.in('client_id', clientIdsInGroup);

    const { data: locations, error: locError } = await locQuery;
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
            const metrics = await fetchWithRetry(() => fetchGBPDay(location.gbp_location_id, syncDate), 'metrics');

            const row = transformGBPMetrics(metrics, location.id, location.client_id, syncDate);

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
      const reviewsAccessToken = await GBPTokenManager.getAccessToken().catch(() => null);
      for (const location of validLocations) {
        try {
          if (!reviewsAccessToken) throw new Error('No GBP access token for reviews');
          const reviewData = await fetchLocationReviews(reviewsAccessToken, gbpAccountId, location.gbp_location_id);
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

    if (errors.length > 0) {
      sendCronFailureAlert('sync-gbp', targetDate, errors).catch(() => {});
    }

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

