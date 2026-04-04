import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPRangePerDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';

export const maxDuration = 300;

/**
 * GET /api/admin/gbp-backfill-range
 *
 * Backfill GBP per-day data for a date range.
 * Uses fetchGBPRangePerDay → 7 API calls total per location (not per day),
 * then upserts one DB row per day — overwriting stale data with accurate range data.
 *
 * Query params:
 *   start   YYYY-MM-DD  (required)
 *   end     YYYY-MM-DD  (required)
 *   slug    string      (optional) Client slug, e.g. chirosolutions-center
 *
 * Auth: Bearer CRON_SECRET header
 *
 * Example:
 *   curl -H "Authorization: Bearer $SECRET" \
 *     "https://…/api/admin/gbp-backfill-range?start=2026-03-01&end=2026-03-31"
 *   curl -H "Authorization: Bearer $SECRET" \
 *     "https://…/api/admin/gbp-backfill-range?start=2026-03-01&end=2026-03-31&slug=chirosolutions-center"
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
    const start = request.nextUrl.searchParams.get('start');
    const end = request.nextUrl.searchParams.get('end');
    const slug = request.nextUrl.searchParams.get('slug');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required params: start and end (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(start) || !dateRe.test(end)) {
      return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: 'start must be <= end' }, { status: 400 });
    }

    console.log(`[gbp-backfill-range] ${start} → ${end}${slug ? ` (slug: ${slug})` : ''}`);

    // ── Load active GBP locations, optionally filtered by client slug ────────
    let locQuery = supabaseAdmin
      .from('gbp_locations')
      .select('id, client_id, gbp_location_id, location_name, clients!inner(slug)')
      .eq('is_active', true);

    if (slug) {
      locQuery = locQuery.eq('clients.slug', slug);
    }

    const { data: locations, error: locError } = await locQuery;
    if (locError) throw new Error(`Failed to fetch GBP locations: ${locError.message}`);

    const validLocations = (locations || []).filter((l: any) => l.gbp_location_id);

    if (validLocations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: slug
            ? `Client "${slug}" not found or has no active GBP location`
            : 'No active GBP locations found',
        },
        { status: 404 }
      );
    }

    console.log(`[gbp-backfill-range] ${validLocations.length} location(s) to process`);

    // ── Collect all unique dates in range (for rollup trigger) ───────────────
    const allDatesInRange: string[] = [];
    const cur = new Date(start);
    const endD = new Date(end);
    while (cur <= endD) {
      allDatesInRange.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    // ── Process locations in batches of 3 ───────────────────────────────────
    const BATCH_SIZE = 3;
    const errors: string[] = [];
    let totalRows = 0;

    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (location: any) => {
          try {
            console.log(
              `[gbp-backfill-range] Fetching ${location.location_name} (${start} → ${end})`
            );

            const byDay = await fetchGBPRangePerDay(
              location.gbp_location_id,
              start,
              end
            );

            if (!byDay || byDay.size === 0) {
              console.log(`[gbp-backfill-range] No data for ${location.location_name}`);
              return;
            }

            const rows: ReturnType<typeof transformGBPMetrics>[] = [];
            for (const [date, metrics] of byDay) {
              const row = transformGBPMetrics(metrics, location.id, location.client_id, date);
              rows.push(row);
            }

            if (rows.length === 0) return;

            // Upsert with ignoreDuplicates: false → OVERWRITE existing rows
            // This replaces any previously stored per-day (single-day API) data
            // with the more accurate range-query data.
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(rows, { onConflict: 'location_id,date', ignoreDuplicates: false });

            if (error) {
              errors.push(`${location.location_name} upsert: ${error.message}`);
              console.error(`[gbp-backfill-range] Upsert error for ${location.location_name}:`, error.message);
            } else {
              totalRows += rows.length;
              console.log(
                `[gbp-backfill-range] ${location.location_name}: upserted ${rows.length} rows`
              );
            }
          } catch (err: any) {
            const msg = `${location.location_name}: ${err.message}`;
            errors.push(msg);
            console.error(`[gbp-backfill-range] Error for ${location.location_name}:`, err.message);
          }
        })
      );
    }

    // ── Trigger rollup for each date in range ────────────────────────────────
    // Fire-and-forget in the background; don't let rollup failures block response.
    console.log(`[gbp-backfill-range] Triggering rollup for ${allDatesInRange.length} dates…`);
    triggerRollupForDates(allDatesInRange, request).catch((err) =>
      console.error('[gbp-backfill-range] Rollup trigger error:', err)
    );

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `[gbp-backfill-range] Done in ${durationSec}s: ` +
        `locations=${validLocations.length}, totalRows=${totalRows}, errors=${errors.length}`
    );

    return NextResponse.json({
      success: true,
      start,
      end,
      locations: validLocations.length,
      dates: allDatesInRange.length,
      totalRows,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${durationSec}s`,
    });
  } catch (err: any) {
    console.error('[gbp-backfill-range] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── Helper: trigger rollup for each date sequentially ───────────────────────

async function triggerRollupForDates(dates: string[], req: NextRequest): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
  const cronSecret = process.env.CRON_SECRET;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cronSecret) headers['Authorization'] = `Bearer ${cronSecret}`;

  for (const date of dates) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/run-rollup?date=${date}`, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.warn(`[gbp-backfill-range] Rollup for ${date} returned ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[gbp-backfill-range] Rollup for ${date} failed: ${err.message}`);
    }
  }
}
