import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';
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
    const targetDate = dateParam || (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();
    const groupParam = request.nextUrl.searchParams.get('group');   // 'A' | 'B' | 'C'
    const clientIdParam = request.nextUrl.searchParams.get('clientId');

    console.log(`[sync-gbp] Starting for ${targetDate}${groupParam ? ` group=${groupParam}` : ''}${clientIdParam ? ` clientId=${clientIdParam}` : ''}`);

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

    const validLocations = (locations || []).filter((l: any) => l.gbp_location_id);
    console.log(`[sync-gbp] Processing ${validLocations.length} locations`);

    let synced = 0;
    const errors: string[] = [];

    // Step 3: Process in batches of 3
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
          const metrics = await fetchWithRetry(() => fetchGBPDay(location.gbp_location_id, targetDate), 'metrics');

          const metricsWithValue = Object.entries(metrics).filter(([_, v]: [string, any]) => v > 0).length;
          if (metricsWithValue === 0) {
            console.warn(`[sync-gbp] ⚠️  WARNING: No metrics for ${location.location_name} on ${targetDate}`);
          }

          const row = {
            ...transformGBPMetrics(metrics, location.id, location.client_id, targetDate),
            fetch_status: 'success',
            fetch_error: null,
          };

          const { error: upsertError } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .upsert(row, { onConflict: 'location_id,date' });

          if (upsertError) {
            throw new Error(`upsert failed: ${upsertError.message}`);
          }

          console.log(`[sync-gbp] ✅ ${location.location_name}: views=${row.views}, calls=${row.phone_calls}, clicks=${row.website_clicks}, directions=${row.direction_requests}`);
          return 1;
        } catch (err: any) {
          const errMsg = `${location.location_name}: ${err.message}`;
          errors.push(errMsg);
          console.error(`[sync-gbp] ❌ ${errMsg}`);
          // Upsert error row so health-check can detect it
          // Upsert error row so health-check can detect it (fire-and-forget)
          void supabaseAdmin.from('gbp_location_daily_metrics').upsert({
            location_id: location.id,
            client_id: location.client_id,
            date: targetDate,
            fetch_status: 'error',
            fetch_error: err.message,
            phone_calls: 0, website_clicks: 0, direction_requests: 0, views: 0, actions: 0,
          }, { onConflict: 'location_id,date' });
          return 0;
        }
      }));

      synced += results.reduce((sum: number, r: number) => sum + r, 0);
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-gbp] Done in ${duration}ms: ${synced}/${validLocations.length} locations synced`);

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
