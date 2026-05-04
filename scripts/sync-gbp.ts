import { supabaseAdmin } from '../src/lib/supabase';
import { fetchGBPRangePerDay, transformGBPMetrics } from '../src/lib/gbp-fetch-utils';
import { GBPTokenManager } from '../src/lib/gbp-token-manager';
import { sendCronFailureAlert, saveCronStatus, sendTelegramMessage } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 3;

async function main() {
  const startTime = Date.now();

  try {
    const dateParam = ((process.env.DATE || getArg('date') || '').trim() || undefined);
    const datesToSync: string[] = dateParam ? [dateParam] : (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dates: string[] = [];
      for (let i = 1; i <= 90; i++) {
        const d = new Date(caToday);
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return dates;
    })();
    const groupParam = process.env.GROUP || getArg('group');
    const clientIdParam = process.env.CLIENT_ID || getArg('clientId');

    const targetDate = datesToSync[0];
    console.log(`[sync-gbp] Starting for ${datesToSync.length > 1 ? `${datesToSync[datesToSync.length - 1]} to ${datesToSync[0]} (${datesToSync.length} days)` : targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'gbp_agency_master')
      .single();

    if (tokenError) {
      console.error('[sync-gbp] Token lookup error:', tokenError.message);
      throw new Error(`Token lookup failed: ${tokenError.message}`);
    }

    if (!tokenData?.value) {
      console.error('[sync-gbp] No GBP token in system_settings');
      throw new Error('No GBP OAuth token found. Run manual OAuth setup at /admin/google-business-setup first.');
    }

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
        throw new Error(`Client ${clientIdParam} not found or has no GBP location`);
      }
    }
    console.log(`[sync-gbp] Processing ${validLocations.length} locations`);

    let synced = 0;
    const errors: string[] = [];

    const oldestDate = datesToSync[datesToSync.length - 1];
    const latestDate = datesToSync[0];

    const fetchWithRetry = async (fn: () => Promise<any>, label: string) => {
      try {
        return await fn();
      } catch (err: any) {
        console.log(`[sync-gbp] ${label} attempt 1 failed: ${err.message}, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        return await fn();
      }
    };

    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (location) => {
        try {
          const perDayMap = await fetchWithRetry(
            () => fetchGBPRangePerDay(location.gbp_location_id, oldestDate, latestDate),
            `${location.location_name} range ${oldestDate}→${latestDate}`
          );

          let locationSynced = 0;
          for (const syncDate of datesToSync) {
            const metrics = perDayMap.get(syncDate);
            if (!metrics) continue;

            const row = transformGBPMetrics(metrics, location.id, location.client_id, syncDate);

            const hasData = row.phone_calls + row.website_clicks + row.direction_requests + row.views > 0;
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(row, {
                onConflict: 'location_id,date',
                ignoreDuplicates: !hasData,
              });

            if (error) {
              console.log(`[sync-gbp] Upsert error ${location.location_name} ${syncDate}:`, error.message);
            } else {
              locationSynced++;
            }
          }

          return locationSynced;
        } catch (err: any) {
          errors.push(`${location.location_name} (${oldestDate}→${latestDate}): ${err.message}`);
          return 0;
        }
      }));

      synced += results.reduce((sum: number, r: number) => sum + r, 0);
    }

    const gbpAccountId = process.env.GBP_ACCOUNT_ID;
    const mostRecentDate = datesToSync[0];
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

    await saveCronStatus(supabaseAdmin, 'sync_gbp', {
      clients: validLocations.length,
      records: synced,
      errors,
      duration,
    }).catch(() => {});

    const result = {
      success: true,
      date: targetDate,
      locations: validLocations.length,
      synced,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error('[sync-gbp] Error:', error);
    throw new Error(error.message);
  }
}

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

main().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(async e => { console.error('FAILED:', e.message); await sendTelegramMessage(`🔴 <b>Sync CRASHED</b>: ${e.message}`).catch(() => {}); process.exit(1); });
