import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';

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
      // Use California timezone for "yesterday" calculation
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();

    console.log(`[sync-gbp] Starting for ${targetDate}`);

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

          // Validation: Check if we got data from all expected metrics
          const metricsWithValue = Object.entries(metrics).filter(([_, v]: [string, any]) => v > 0).length;
          if (metricsWithValue === 0) {
            console.warn(`[sync-gbp] ⚠️  WARNING: No metrics returned for ${location.location_name} on ${targetDate}`);
            console.warn(`[sync-gbp] Metrics received: ${JSON.stringify(metrics)}`);
          }

          const row = transformGBPMetrics(metrics, location.id, location.client_id, targetDate);

          const { error: upsertError } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .upsert(row, { onConflict: 'location_id,date' });

          if (upsertError) {
            const msg = `Failed to save: ${upsertError.message}`;
            console.error(`[sync-gbp] ${location.location_name} upsert error:`, msg);
            throw new Error(`${location.location_name} upsert failed: ${upsertError.message}`);
          }

          console.log(`[sync-gbp] ✅ ${location.location_name}: views=${row.views}, calls=${row.phone_calls}, clicks=${row.website_clicks}, directions=${row.direction_requests}`);
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
