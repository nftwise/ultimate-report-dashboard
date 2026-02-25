#!/usr/bin/env npx tsx
/**
 * GBP Backfill Direct Script
 * Fetches GBP Performance API data and writes directly to Supabase.
 * No local server required.
 *
 * Usage:
 *   npx tsx scripts/gbp-backfill-direct.ts
 *   npx tsx scripts/gbp-backfill-direct.ts --days=90 --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

const BATCH_SIZE = 3; // locations processed concurrently
const BATCH_DELAY_MS = 2000; // delay between batches
const METRIC_DELAY_MS = 300; // delay between metric fetches per location
const TIMEOUT_MS = 20000;

// GBP Performance API metrics (GET method only)
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
] as const;

// CLI args
const daysBack = parseInt(
  process.argv.find(a => a.startsWith('--days'))?.split('=')[1] || '90',
  10,
);
const dryRun = process.argv.includes('--dry-run');

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// TOKEN MANAGEMENT
// ---------------------------------------------------------------------------
interface StoredToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email?: string;
}

async function getStoredToken(): Promise<StoredToken | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  if (error || !data) {
    console.error('[token] Failed to read from system_settings:', error?.message);
    return null;
  }

  try {
    return JSON.parse(data.value) as StoredToken;
  } catch {
    console.error('[token] Failed to parse token JSON');
    return null;
  }
}

async function refreshAccessToken(stored: StoredToken): Promise<StoredToken | null> {
  console.log('[token] Access token expired, refreshing...');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: stored.refresh_token,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('[token] Refresh failed:', resp.status, errText);
    return null;
  }

  const json = await resp.json();
  const updated: StoredToken = {
    access_token: json.access_token,
    refresh_token: stored.refresh_token, // keep existing refresh token
    expiry_date: Date.now() + (json.expires_in || 3600) * 1000,
    email: stored.email,
  };

  // Save back to Supabase
  const { error } = await supabase
    .from('system_settings')
    .upsert(
      { key: 'gbp_agency_master', value: JSON.stringify(updated), updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

  if (error) {
    console.error('[token] Failed to save refreshed token:', error.message);
  } else {
    console.log('[token] Refreshed and saved successfully');
  }

  return updated;
}

async function getAccessToken(): Promise<string | null> {
  let stored = await getStoredToken();
  if (!stored) return null;

  // Check if expired (5 min buffer)
  if (stored.expiry_date < Date.now() + 5 * 60 * 1000) {
    if (!stored.refresh_token) {
      console.error('[token] Token expired and no refresh_token available');
      return null;
    }
    stored = await refreshAccessToken(stored);
    if (!stored) return null;
  }

  console.log(`[token] Using token for ${stored.email || 'unknown'}, expires ${new Date(stored.expiry_date).toISOString()}`);
  return stored.access_token;
}

// ---------------------------------------------------------------------------
// GBP LOCATIONS FROM SUPABASE
// ---------------------------------------------------------------------------
interface GBPLocation {
  id: string;          // uuid PK in gbp_locations
  client_id: string;
  gbp_location_id: string; // e.g. "locations/123456"
  location_name: string;
}

async function fetchLocations(): Promise<GBPLocation[]> {
  const { data, error } = await supabase
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name')
    .eq('is_active', true);

  if (error) {
    console.error('[locations] Error:', error.message);
    return [];
  }
  return (data || []).filter((l: any) => l.gbp_location_id);
}

// ---------------------------------------------------------------------------
// GBP PERFORMANCE API
// ---------------------------------------------------------------------------
function normalizeLocationId(raw: string): string {
  if (raw.includes('/locations/')) {
    return `locations/${raw.split('/locations/')[1]}`;
  }
  if (!raw.startsWith('locations/')) {
    return `locations/${raw}`;
  }
  return raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface DailyRow {
  location_id: string;
  client_id: string;
  date: string;
  views: number;
  actions: number;
  direction_requests: number;
  phone_calls: number;
  website_clicks: number;
}

/**
 * Fetch all 7 metrics for a location over a date range.
 * Returns one row per day with summed impressions as views.
 */
async function fetchLocationTimeSeries(
  accessToken: string,
  location: GBPLocation,
  startDate: string,
  endDate: string,
): Promise<DailyRow[]> {
  const locationId = normalizeLocationId(location.gbp_location_id);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  // Keyed by date string -> partial metric values
  const byDate: Record<string, Record<string, number>> = {};

  for (const metric of METRICS) {
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`,
    );
    url.searchParams.set('dailyMetric', metric);
    url.searchParams.set('dailyRange.start_date.year', String(startYear));
    url.searchParams.set('dailyRange.start_date.month', String(startMonth));
    url.searchParams.set('dailyRange.start_date.day', String(startDay));
    url.searchParams.set('dailyRange.end_date.year', String(endYear));
    url.searchParams.set('dailyRange.end_date.month', String(endMonth));
    url.searchParams.set('dailyRange.end_date.day', String(endDay));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errText = await resp.text();
        if (resp.status === 429) {
          console.warn(`  [rate-limit] ${metric} for ${location.location_name}, waiting 10s...`);
          await sleep(10000);
        } else {
          console.warn(`  [api] ${metric} ${resp.status}: ${errText.slice(0, 120)}`);
        }
        continue;
      }

      const data = await resp.json();
      const datedValues = data.timeSeries?.datedValues || [];

      for (const dv of datedValues) {
        const dateStr = `${dv.date.year}-${String(dv.date.month).padStart(2, '0')}-${String(dv.date.day).padStart(2, '0')}`;
        if (!byDate[dateStr]) byDate[dateStr] = {};
        byDate[dateStr][metric] = parseInt(dv.value || '0', 10) || 0;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`  [timeout] ${metric} for ${location.location_name}`);
      } else {
        console.warn(`  [error] ${metric}: ${err.message}`);
      }
    }

    // Small delay between metric requests
    await sleep(METRIC_DELAY_MS);
  }

  // Build rows
  const rows: DailyRow[] = [];
  for (const [dateStr, metrics] of Object.entries(byDate)) {
    const websiteClicks = metrics['WEBSITE_CLICKS'] || 0;
    const directions = metrics['BUSINESS_DIRECTION_REQUESTS'] || 0;
    const calls = metrics['CALL_CLICKS'] || 0;
    const views =
      (metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS'] || 0) +
      (metrics['BUSINESS_IMPRESSIONS_MOBILE_MAPS'] || 0) +
      (metrics['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'] || 0) +
      (metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH'] || 0);

    rows.push({
      location_id: location.id,
      client_id: location.client_id,
      date: dateStr,
      views,
      actions: websiteClicks + directions + calls,
      direction_requests: directions,
      phone_calls: calls,
      website_clicks: websiteClicks,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// UPSERT TO SUPABASE
// ---------------------------------------------------------------------------
async function upsertRows(rows: DailyRow[]): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  let inserted = 0;
  let errCount = 0;

  // Upsert in chunks of 200
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('gbp_location_daily_metrics')
      .upsert(chunk, { onConflict: 'location_id,date' });

    if (error) {
      console.error(`  [upsert] Error at chunk ${i}: ${error.message}`);
      errCount += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }

  return { inserted, errors: errCount };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== GBP Backfill Direct ===');
  console.log(`  Days back: ${daysBack}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log('');

  // 1. Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('FATAL: Could not obtain GBP access token');
    process.exit(1);
  }

  // 2. Fetch locations from Supabase
  const locations = await fetchLocations();
  console.log(`[locations] Found ${locations.length} active GBP locations\n`);

  if (locations.length === 0) {
    console.log('No locations to process. Exiting.');
    process.exit(0);
  }

  // 3. Date range
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // yesterday (today's data not yet available)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  console.log(`[dates] Range: ${startStr} to ${endStr}\n`);

  // 4. Process locations in batches
  let totalRows = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(locations.length / BATCH_SIZE);
    console.log(`--- Batch ${batchNum}/${totalBatches} ---`);

    const batchResults = await Promise.all(
      batch.map(async (loc) => {
        console.log(`  Fetching: ${loc.location_name} (${loc.gbp_location_id})`);
        try {
          const rows = await fetchLocationTimeSeries(accessToken, loc, startStr, endStr);
          console.log(`  -> ${loc.location_name}: ${rows.length} daily records fetched`);

          if (dryRun) {
            if (rows.length > 0) {
              console.log(`  [dry-run] Sample: ${JSON.stringify(rows[0])}`);
            }
            return { fetched: rows.length, inserted: 0, errors: 0 };
          }

          const result = await upsertRows(rows);
          console.log(`  -> ${loc.location_name}: ${result.inserted} upserted, ${result.errors} errors`);
          return { fetched: rows.length, ...result };
        } catch (err: any) {
          console.error(`  ERROR ${loc.location_name}: ${err.message}`);
          return { fetched: 0, inserted: 0, errors: 1 };
        }
      }),
    );

    for (const r of batchResults) {
      totalRows += r.fetched;
      totalInserted += r.inserted;
      totalErrors += r.errors;
    }

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < locations.length) {
      console.log(`  (waiting ${BATCH_DELAY_MS}ms before next batch)\n`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // 5. Summary
  console.log('\n=== BACKFILL COMPLETE ===');
  console.log(`  Locations processed: ${locations.length}`);
  console.log(`  Total daily records fetched: ${totalRows}`);
  console.log(`  Total upserted: ${totalInserted}`);
  console.log(`  Total errors: ${totalErrors}`);
  if (dryRun) console.log('  (DRY RUN - no data was written)');
  console.log('');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
