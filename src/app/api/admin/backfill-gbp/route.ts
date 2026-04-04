import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPRangePerDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';
import { sendCronFailureAlert } from '@/lib/telegram';

export const maxDuration = 300;

/**
 * GET /api/admin/backfill-gbp
 *
 * Backfill GBP metrics for a date range — fetches the range ONCE per metric
 * per location (7 API calls total), then inserts a separate DB row per day.
 *
 * This is far more efficient than the daily cron (which does 7 calls per day
 * per location). Use this for historical backfills or re-syncing stale months.
 *
 * Query params:
 *   startDate  YYYY-MM-DD  (required) First day of the range
 *   endDate    YYYY-MM-DD  (required) Last day of the range
 *   clientId   UUID        (optional) Restrict to one client
 *   overwrite  "true"      (optional) Overwrite existing rows even if they have data
 *                          Default: false — never overwrite real data with zeros
 *
 * Auth: Bearer CRON_SECRET header (same as cron endpoints)
 *
 * Examples:
 *   curl "/api/admin/backfill-gbp?startDate=2026-03-01&endDate=2026-03-31"
 *   curl "/api/admin/backfill-gbp?startDate=2026-01-01&endDate=2026-03-31&clientId=UUID"
 *   curl "/api/admin/backfill-gbp?startDate=2026-02-01&endDate=2026-02-28&overwrite=true"
 */
export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ── Parse params ────────────────────────────────────────────────────────
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    const clientIdParam = request.nextUrl.searchParams.get('clientId');
    const overwrite = request.nextUrl.searchParams.get('overwrite') === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required params: startDate and endDate (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Basic date validation
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'startDate must be <= endDate' },
        { status: 400 }
      );
    }

    console.log(`[backfill-gbp] Starting range ${startDate} → ${endDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''} overwrite=${overwrite}`);

    // ── Verify GBP token exists ──────────────────────────────────────────────
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'gbp_agency_master')
      .single();

    if (tokenError) {
      return NextResponse.json(
        { success: false, error: `Token lookup failed: ${tokenError.message}` },
        { status: 500 }
      );
    }

    if (!tokenData?.value) {
      return NextResponse.json(
        {
          success: false,
          error: 'No GBP OAuth token found. Run manual OAuth setup at /admin/google-business-setup first.',
        },
        { status: 500 }
      );
    }

    // ── Fetch active GBP locations ───────────────────────────────────────────
    let locQuery = supabaseAdmin
      .from('gbp_locations')
      .select('id, client_id, gbp_location_id, location_name')
      .eq('is_active', true);

    if (clientIdParam) {
      locQuery = locQuery.eq('client_id', clientIdParam);
    }

    const { data: locations, error: locError } = await locQuery;
    if (locError) throw new Error(`Failed to fetch GBP locations: ${locError.message}`);

    const validLocations = (locations || []).filter((l: any) => l.gbp_location_id);

    if (validLocations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: clientIdParam
            ? `Client ${clientIdParam} not found or has no active GBP location`
            : 'No active GBP locations found',
        },
        { status: 404 }
      );
    }

    console.log(`[backfill-gbp] Processing ${validLocations.length} location(s) over ${startDate} → ${endDate}`);

    // ── Process locations sequentially (avoid token rate-limits) ────────────
    // Each location makes 7 parallel API calls for the full range.
    // Sequential locations prevents 25 × 7 = 175 concurrent requests.
    const errors: string[] = [];
    let totalDaysUpserted = 0;
    let totalDaysSkipped = 0;

    for (const location of validLocations) {
      try {
        console.log(`[backfill-gbp] Fetching ${location.location_name} (${startDate} → ${endDate})`);

        // One call to fetch the full range — returns per-day Map
        const byDay = await fetchWithRetry(
          () => fetchGBPRangePerDay(location.gbp_location_id, startDate, endDate),
          location.location_name
        );

        if (!byDay || byDay.size === 0) {
          console.log(`[backfill-gbp] No data returned for ${location.location_name}`);
          continue;
        }

        // Build upsert rows from the per-day map
        const rows = [];
        for (const [date, metrics] of byDay) {
          const row = transformGBPMetrics(metrics, location.id, location.client_id, date);
          rows.push(row);
        }

        if (rows.length === 0) continue;

        if (overwrite) {
          // Force overwrite all rows (useful for re-syncing after API data stabilises)
          const { error } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .upsert(rows, { onConflict: 'location_id,date' });

          if (error) {
            errors.push(`${location.location_name} upsert: ${error.message}`);
          } else {
            totalDaysUpserted += rows.length;
            console.log(`[backfill-gbp] ${location.location_name}: upserted ${rows.length} rows (overwrite)`);
          }
        } else {
          // Default: split rows into "has data" vs "zero" groups
          // - Rows with real data → full upsert (overwrite any prior zeros)
          // - Rows with zeros → INSERT ONLY if no existing row (ignoreDuplicates)
          const dataRows = rows.filter(r => r.phone_calls + r.website_clicks + r.direction_requests + r.views > 0);
          const zeroRows = rows.filter(r => r.phone_calls + r.website_clicks + r.direction_requests + r.views === 0);

          if (dataRows.length > 0) {
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(dataRows, { onConflict: 'location_id,date' });

            if (error) {
              errors.push(`${location.location_name} data-rows upsert: ${error.message}`);
            } else {
              totalDaysUpserted += dataRows.length;
            }
          }

          if (zeroRows.length > 0) {
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(zeroRows, { onConflict: 'location_id,date', ignoreDuplicates: true });

            if (error) {
              errors.push(`${location.location_name} zero-rows insert: ${error.message}`);
            } else {
              totalDaysSkipped += zeroRows.length; // "skipped if existed"
            }
          }

          console.log(`[backfill-gbp] ${location.location_name}: ${dataRows.length} data rows, ${zeroRows.length} zero rows`);
        }
      } catch (err: any) {
        const msg = `${location.location_name}: ${err.message}`;
        errors.push(msg);
        console.error(`[backfill-gbp] Error for ${location.location_name}:`, err.message);
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (errors.length > 0) {
      sendCronFailureAlert('backfill-gbp', `${startDate}→${endDate}`, errors).catch(() => {});
    }

    console.log(
      `[backfill-gbp] Done in ${durationSec}s: ${totalDaysUpserted} rows upserted, ` +
        `${totalDaysSkipped} zeros skipped, ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      locations: validLocations.length,
      daysUpserted: totalDaysUpserted,
      daysSkipped: totalDaysSkipped,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${durationSec}s`,
    });
  } catch (err: any) {
    console.error('[backfill-gbp] Fatal error:', err);
    sendCronFailureAlert('backfill-gbp', 'fatal', [`${err.message}`]).catch(() => {});
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function fetchWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.log(`[backfill-gbp] ${label} attempt 1 failed (${err.message}), retrying in 3s...`);
    await new Promise(r => setTimeout(r, 3000));
    return await fn(); // let the caller catch attempt 2 failures
  }
}
