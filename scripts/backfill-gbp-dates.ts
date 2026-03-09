#!/usr/bin/env npx tsx
/**
 * GBP Date Backfill — fetch real data for specific date range
 *
 * Usage:
 *   npx tsx scripts/backfill-gbp-dates.ts                     # last 30 days
 *   npx tsx scripts/backfill-gbp-dates.ts 2026-02-01 2026-03-08  # custom range
 *
 * Uses the OAuth token stored in Supabase system_settings.
 * Writes directly to gbp_location_daily_metrics (upsert by location_id+date).
 * Runs rollup after done to update client_metrics_summary.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const METRICS = [
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];

const BATCH_SIZE = 3; // locations per batch
const TIMEOUT_MS = 20000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  if (error || !data) throw new Error('No GBP token in system_settings');
  const token = JSON.parse(data.value);

  if (!token.access_token) throw new Error('Token has no access_token');

  // Check expiry (with 5 min buffer)
  if (token.expiry_date < Date.now() + 5 * 60 * 1000) {
    throw new Error('GBP access token is expired — re-authenticate at /admin/google-business-setup');
  }

  return token.access_token;
}

async function fetchMetricsForDate(
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
  for (const m of METRICS) results[m] = 0;

  await Promise.all(
    METRICS.map(async (metric) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return;

        const data = await response.json();
        results[metric] = (data.timeSeries?.datedValues || [])
          .reduce((s: number, d: any) => s + (parseInt(d.value || '0') || 0), 0);
      } catch {
        results[metric] = 0;
      }
    })
  );

  return results;
}

// ─── rollup helper (same logic as run-rollup-now.ts) ─────────────────────────

async function rollupForDates(dates: string[], clientIds: string[]) {
  console.log(`\n[rollup] Updating client_metrics_summary for ${dates.length} dates × ${clientIds.length} clients…`);

  for (const date of dates) {
    for (const clientId of clientIds) {
      // Fetch GBP from raw table
      const { data: gbp } = await supabase
        .from('gbp_location_daily_metrics')
        .select('phone_calls, website_clicks, direction_requests, views')
        .eq('client_id', clientId)
        .eq('date', date);

      const gbp_calls = (gbp || []).reduce((s, r) => s + (r.phone_calls || 0), 0);
      const gbp_website_clicks = (gbp || []).reduce((s, r) => s + (r.website_clicks || 0), 0);
      const gbp_directions = (gbp || []).reduce((s, r) => s + (r.direction_requests || 0), 0);
      const gbp_profile_views = (gbp || []).reduce((s, r) => s + (r.views || 0), 0);

      if (gbp_calls === 0 && gbp_website_clicks === 0 && gbp_directions === 0) continue; // skip no-data

      // Only update GBP fields — don't overwrite SEO/Ads data
      await supabase
        .from('client_metrics_summary')
        .upsert(
          {
            client_id: clientId,
            date,
            period_type: 'daily',
            gbp_calls,
            gbp_website_clicks,
            gbp_directions,
            gbp_profile_views,
          },
          { onConflict: 'client_id,date,period_type' }
        );
    }
  }

  console.log('[rollup] Done updating GBP fields in client_metrics_summary');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const yesterday = new Date(caToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${caToday.getFullYear()}-${pad(caToday.getMonth() + 1)}-${pad(caToday.getDate())}`;
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  // Parse args: optional start + end date
  const fromDate = process.argv[2] || (() => {
    const d = new Date(caToday);
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const toDate = process.argv[3] || yesterdayStr;

  console.log(`[gbp-backfill] Backfilling GBP: ${fromDate} → ${toDate}`);
  console.log(`[gbp-backfill] Today (CA): ${todayStr}`);

  // Get access token
  const accessToken = await getAccessToken();
  console.log('[gbp-backfill] Got valid access token ✓');

  // Get all active GBP locations
  const { data: locations, error: locErr } = await supabase
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name')
    .eq('is_active', true);

  if (locErr) throw new Error(`Failed to fetch locations: ${locErr.message}`);
  const validLocations = (locations || []).filter(l => l.gbp_location_id);
  console.log(`[gbp-backfill] ${validLocations.length} active GBP locations`);

  const dates = dateRange(fromDate, toDate);
  console.log(`[gbp-backfill] ${dates.length} dates to process`);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const date of dates) {
    process.stdout.write(`[gbp-backfill] ${date}: `);

    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (loc) => {
          try {
            const metrics = await fetchMetricsForDate(accessToken, loc.gbp_location_id, date);

            const row = {
              location_id: loc.id,
              client_id: loc.client_id,
              date,
              views:
                metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS +
                metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS +
                metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH +
                metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
              actions:
                metrics.WEBSITE_CLICKS +
                metrics.BUSINESS_DIRECTION_REQUESTS +
                metrics.CALL_CLICKS,
              direction_requests: metrics.BUSINESS_DIRECTION_REQUESTS,
              phone_calls: metrics.CALL_CLICKS,
              website_clicks: metrics.WEBSITE_CLICKS,
            };

            const { error } = await supabase
              .from('gbp_location_daily_metrics')
              .upsert(row, { onConflict: 'location_id,date' });

            if (error) {
              errors.push(`${date} ${loc.location_name}: ${error.message}`);
              return 'E';
            }

            // Check if we got any real data
            if (row.phone_calls === 0 && row.website_clicks === 0 && row.direction_requests === 0) {
              skipped++;
              return '·';
            }

            synced++;
            return '✓';
          } catch (err: any) {
            errors.push(`${date} ${loc.location_name}: ${err.message}`);
            return 'E';
          }
        })
      );

      process.stdout.write(results.join(''));
    }
    process.stdout.write('\n');
  }

  console.log(`\n[gbp-backfill] Done: ${synced} with data, ${skipped} zeros (API not ready yet), ${errors.length} errors`);

  if (errors.length > 0) {
    console.log('\n[gbp-backfill] Errors:');
    errors.slice(0, 10).forEach(e => console.log(' -', e));
  }

  // Update client_metrics_summary with the new GBP data
  const clientIds = [...new Set(validLocations.map(l => l.client_id))];
  await rollupForDates(dates, clientIds);
}

main().catch(err => {
  console.error('[gbp-backfill] Fatal:', err.message);
  process.exit(1);
});
