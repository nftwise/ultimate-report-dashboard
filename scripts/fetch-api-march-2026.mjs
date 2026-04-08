#!/usr/bin/env node

/**
 * Fetch GBP API data for March 2026 for all active clients
 * Uses date range query (2026-03-01 to 2026-03-31)
 * Returns per-day and total data for all 7 metric types
 */

import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const METRICS = [
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];

const TIMEOUT_MS = 25000;
const START_DATE = '2026-03-01';
const END_DATE = '2026-03-31';

/**
 * Get or refresh GBP access token from system_settings
 */
async function getAccessToken() {
  const { data: tokenData, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  if (error || !tokenData?.value) {
    throw new Error('No GBP token found in system_settings');
  }

  const stored = JSON.parse(tokenData.value);
  const isExpired = stored.expiry_date < Date.now() + 5 * 60 * 1000;

  if (isExpired && stored.refresh_token) {
    console.log('Token expired, refreshing via googleapis...');
    // Dynamic import for googleapis to avoid TS issues in ESM
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: stored.refresh_token });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const refreshed = {
        access_token: credentials.access_token,
        refresh_token: stored.refresh_token,
        expiry_date: credentials.expiry_date,
        email: stored.email,
      };
      await supabase
        .from('system_settings')
        .upsert({ key: 'gbp_agency_master', value: JSON.stringify(refreshed), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      console.log('Token refreshed successfully');
      return credentials.access_token;
    } catch (err) {
      console.warn('Token refresh failed, using existing token:', err.message);
      return stored.access_token;
    }
  }

  if (isExpired) {
    console.warn('Token is expired and no refresh_token available — proceeding with stale token');
  }

  return stored.access_token;
}

/**
 * Normalize location ID to "locations/XXX" format
 */
function normalizeLocationId(locationId) {
  if (locationId.includes('/locations/')) {
    return `locations/${locationId.split('/locations/')[1]}`;
  }
  if (!locationId.startsWith('locations/')) {
    return `locations/${locationId}`;
  }
  return locationId;
}

/**
 * Fetch a single metric for a location across a date range, returning per-day values
 * Returns: Map<"YYYY-MM-DD", number>
 */
async function fetchMetricPerDay(normalizedId, metric, accessToken) {
  const [startYear, startMonth, startDay] = START_DATE.split('-').map(Number);
  const [endYear, endMonth, endDay] = END_DATE.split('-').map(Number);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`
    );
    url.searchParams.set('dailyMetric', metric);
    url.searchParams.set('dailyRange.start_date.year', String(startYear));
    url.searchParams.set('dailyRange.start_date.month', String(startMonth));
    url.searchParams.set('dailyRange.start_date.day', String(startDay));
    url.searchParams.set('dailyRange.end_date.year', String(endYear));
    url.searchParams.set('dailyRange.end_date.month', String(endMonth));
    url.searchParams.set('dailyRange.end_date.day', String(endDay));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return { perDay: new Map(), error: `HTTP ${response.status}: ${text.substring(0, 150)}` };
    }

    const data = await response.json();
    const datedValues = data.timeSeries?.datedValues || [];
    const perDay = new Map();

    for (const dv of datedValues) {
      if (!dv.date) continue;
      const dateStr = `${dv.date.year}-${String(dv.date.month).padStart(2, '0')}-${String(dv.date.day).padStart(2, '0')}`;
      perDay.set(dateStr, parseInt(dv.value || '0') || 0);
    }

    return { perDay, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMsg = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
    return { perDay: new Map(), error: errorMsg };
  }
}

/**
 * Fetch all 7 metrics for a location, returning per-day breakdown and totals
 */
async function fetchLocationData(location, clients, accessToken) {
  const normalizedId = normalizeLocationId(location.gbp_location_id);
  const client = clients.find((c) => c.id === location.client_id);
  const clientName = client?.name || `client_${location.client_id}`;
  const clientSlug = client?.slug || location.client_id;

  process.stdout.write(`  Fetching ${(location.location_name || normalizedId).padEnd(40)}`);

  // Fetch all 7 metrics in parallel
  const metricResults = await Promise.all(
    METRICS.map(async (metric) => {
      const { perDay, error } = await fetchMetricPerDay(normalizedId, metric, accessToken);
      return { metric, perDay, error };
    })
  );

  // Build per-day data structure
  const dailyData = {};
  const totals = {
    calls: 0,
    websiteClicks: 0,
    directions: 0,
    impressions_desktop_maps: 0,
    impressions_mobile_maps: 0,
    impressions_desktop_search: 0,
    impressions_mobile_search: 0,
    views: 0,
  };

  const errors = metricResults.filter((r) => r.error).map((r) => `${r.metric}: ${r.error}`);

  // Collect all dates across all metrics
  const allDates = new Set();
  for (const { perDay } of metricResults) {
    for (const date of perDay.keys()) allDates.add(date);
  }

  for (const date of [...allDates].sort()) {
    const dayEntry = {
      calls: 0,
      websiteClicks: 0,
      directions: 0,
      impressions_desktop_maps: 0,
      impressions_mobile_maps: 0,
      impressions_desktop_search: 0,
      impressions_mobile_search: 0,
      views: 0,
    };

    for (const { metric, perDay } of metricResults) {
      const val = perDay.get(date) || 0;
      switch (metric) {
        case 'CALL_CLICKS': dayEntry.calls = val; break;
        case 'WEBSITE_CLICKS': dayEntry.websiteClicks = val; break;
        case 'BUSINESS_DIRECTION_REQUESTS': dayEntry.directions = val; break;
        case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS': dayEntry.impressions_desktop_maps = val; break;
        case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS': dayEntry.impressions_mobile_maps = val; break;
        case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH': dayEntry.impressions_desktop_search = val; break;
        case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH': dayEntry.impressions_mobile_search = val; break;
      }
    }

    dayEntry.views =
      dayEntry.impressions_desktop_maps +
      dayEntry.impressions_mobile_maps +
      dayEntry.impressions_desktop_search +
      dayEntry.impressions_mobile_search;

    dailyData[date] = dayEntry;

    // Accumulate totals
    totals.calls += dayEntry.calls;
    totals.websiteClicks += dayEntry.websiteClicks;
    totals.directions += dayEntry.directions;
    totals.impressions_desktop_maps += dayEntry.impressions_desktop_maps;
    totals.impressions_mobile_maps += dayEntry.impressions_mobile_maps;
    totals.impressions_desktop_search += dayEntry.impressions_desktop_search;
    totals.impressions_mobile_search += dayEntry.impressions_mobile_search;
    totals.views += dayEntry.views;
  }

  const daysWithData = Object.keys(dailyData).length;
  const statusIcon = errors.length === 0 ? '✅' : errors.length === METRICS.length ? '❌' : '⚠️';
  console.log(
    ` ${statusIcon} calls=${totals.calls} clicks=${totals.websiteClicks} dir=${totals.directions} views=${totals.views} (${daysWithData} days)`
  );

  if (errors.length > 0 && errors.length < METRICS.length) {
    console.log(`     Partial errors: ${errors.join(', ')}`);
  } else if (errors.length === METRICS.length) {
    console.log(`     All metrics failed: ${errors[0]}`);
  }

  return {
    locationId: location.gbp_location_id,
    locationDbId: location.id,
    locationName: location.location_name,
    clientId: location.client_id,
    clientName,
    clientSlug,
    gbp: {
      calls: totals.calls,
      websiteClicks: totals.websiteClicks,
      directions: totals.directions,
      views: totals.views,
      impressions_desktop_maps: totals.impressions_desktop_maps,
      impressions_mobile_maps: totals.impressions_mobile_maps,
      impressions_desktop_search: totals.impressions_desktop_search,
      impressions_mobile_search: totals.impressions_mobile_search,
      daysWithData,
      dailyData,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('GBP API FETCH - MARCH 2026 (2026-03-01 to 2026-03-31)');
  console.log('='.repeat(70));
  console.log();

  // Step 1: Get access token
  console.log('Step 1: Getting GBP access token...');
  let accessToken;
  try {
    accessToken = await getAccessToken();
    const expiryCheck = accessToken ? 'obtained' : 'null';
    console.log(`Access token: ${expiryCheck}\n`);
  } catch (err) {
    console.error('FATAL: Could not get access token:', err.message);
    process.exit(1);
  }

  // Step 2: Fetch all active GBP locations
  console.log('Step 2: Fetching active GBP locations...');
  const { data: locations, error: locError } = await supabase
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name')
    .eq('is_active', true);

  if (locError) {
    console.error('FATAL: Failed to fetch locations:', locError.message);
    process.exit(1);
  }

  const validLocations = (locations || []).filter((l) => l.gbp_location_id);
  console.log(`Found ${validLocations.length} active GBP locations\n`);

  // Step 3: Fetch client info for name/slug
  console.log('Step 3: Fetching client info...');
  const clientIds = [...new Set(validLocations.map((l) => l.client_id))];
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug')
    .in('id', clientIds);

  if (clientError) {
    console.error('Warning: Failed to fetch clients:', clientError.message);
  }
  console.log(`Fetched ${(clients || []).length} clients\n`);

  // Step 4: Fetch GBP metrics for each location
  console.log('Step 4: Fetching March 2026 GBP metrics for each location...');
  console.log('-'.repeat(70));

  const locationResults = [];
  let successCount = 0;
  let errorCount = 0;

  for (const location of validLocations) {
    try {
      const result = await fetchLocationData(location, clients || [], accessToken);
      locationResults.push(result);
      if (!result.errors || result.errors.length < METRICS.length) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error(`  ERROR for ${location.location_name}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('-'.repeat(70));
  console.log();

  // Step 5: Build summary
  const grandTotal = locationResults.reduce(
    (acc, loc) => {
      acc.calls += loc.gbp.calls;
      acc.websiteClicks += loc.gbp.websiteClicks;
      acc.directions += loc.gbp.directions;
      acc.views += loc.gbp.views;
      return acc;
    },
    { calls: 0, websiteClicks: 0, directions: 0, views: 0 }
  );

  console.log('='.repeat(70));
  console.log('MARCH 2026 SUMMARY - ALL CLIENTS');
  console.log('='.repeat(70));

  // Sort by calls desc for summary display
  const sorted = [...locationResults].sort((a, b) => b.gbp.calls - a.gbp.calls);
  sorted.forEach((loc, i) => {
    const name = `${loc.clientName} (${loc.locationName || loc.locationId})`.substring(0, 50);
    console.log(
      `${String(i + 1).padStart(2)}. ${name.padEnd(52)} calls=${String(loc.gbp.calls).padStart(5)} clicks=${String(loc.gbp.websiteClicks).padStart(5)} dir=${String(loc.gbp.directions).padStart(5)} views=${String(loc.gbp.views).padStart(7)}`
    );
  });

  console.log('='.repeat(70));
  console.log(`GRAND TOTAL: calls=${grandTotal.calls}  websiteClicks=${grandTotal.websiteClicks}  directions=${grandTotal.directions}  views=${grandTotal.views}`);
  console.log(`Locations: ${validLocations.length}  Success: ${successCount}  Errors: ${errorCount}`);
  console.log('='.repeat(70));

  // Step 6: Save JSON output
  const output = {
    fetchedAt: new Date().toISOString(),
    period: { start: START_DATE, end: END_DATE },
    summary: {
      totalLocations: validLocations.length,
      successCount,
      errorCount,
      grandTotal,
    },
    locations: locationResults,
  };

  const outputPath = '/tmp/api_march_2026.json';
  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
