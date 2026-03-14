#!/usr/bin/env node

/**
 * Fetch GBP Feb 2026 data (CALL_CLICKS)
 * Uses date range method (2026-02-01 to 2026-02-28)
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Hardcoded Supabase credentials
const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

const TIMEOUT_MS = 20000;
const GOOGLE_OAUTH_CLIENT_ID = 'GOOGLE_OAUTH_CLIENT_ID_PLACEHOLDER';
const GOOGLE_OAUTH_CLIENT_SECRET = 'GOOGLE_OAUTH_CLIENT_SECRET_PLACEHOLDER';

async function getRefreshedToken() {
  // Get token from DB
  const { data: tokenData } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  if (!tokenData?.value) throw new Error('No GBP token found');

  const stored = JSON.parse(tokenData.value);
  const isExpired = stored.expiry_date < Date.now() + 5 * 60 * 1000;

  // If expired, refresh it
  if (isExpired && stored.refresh_token) {
    console.log('🔄 Token expired, refreshing...');
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: stored.refresh_token });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Save refreshed token
      await supabaseAdmin
        .from('system_settings')
        .upsert({
          key: 'gbp_agency_master',
          value: JSON.stringify({
            access_token: credentials.access_token,
            refresh_token: stored.refresh_token,
            expiry_date: credentials.expiry_date,
            email: stored.email,
          }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      console.log('✅ Token refreshed\n');
      return credentials.access_token;
    } catch (err) {
      console.error('❌ Token refresh failed:', err.message);
      throw err;
    }
  }

  return stored.access_token;
}

async function fetchGBPMetrics(locationId, startDate, endDate, metric, accessToken) {
  try {
    // Normalize location ID
    let normalizedId = locationId;
    if (normalizedId.includes('/locations/')) {
      normalizedId = `locations/${normalizedId.split('/locations/')[1]}`;
    } else if (!normalizedId.startsWith('locations/')) {
      normalizedId = `locations/${normalizedId}`;
    }

    // Parse dates
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    // Fetch metric
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return { value: 0, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }

    const data = await response.json();
    const value = (data.timeSeries?.datedValues || [])
      .reduce((sum, d) => sum + (parseInt(d.value || '0') || 0), 0);

    return { value, error: null };
  } catch (err) {
    return { value: 0, error: err.message };
  }
}

async function main() {
  try {
    console.log('📥 Fetching GBP Feb 2026 CALL_CLICKS for all locations...\n');

    // Get refreshed token
    const accessToken = await getRefreshedToken();

    // Get all active GBP locations
    const { data: locations, error: locError } = await supabaseAdmin
      .from('gbp_locations')
      .select('id, client_id, gbp_location_id, location_name')
      .eq('is_active', true);

    if (locError) throw new Error(`Failed to fetch locations: ${locError.message}`);

    const validLocations = (locations || []).filter(l => l.gbp_location_id);
    console.log(`Found ${validLocations.length} active GBP locations\n`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const location of validLocations) {
      process.stdout.write(`⏳ ${location.location_name.padEnd(35)}`);

      const { value: calls, error } = await fetchGBPMetrics(
        location.gbp_location_id,
        '2026-02-01',
        '2026-02-28',
        'CALL_CLICKS',
        accessToken
      );

      if (error) {
        console.log(` ❌ ${error}`);
        errorCount++;
      } else {
        console.log(` ✅ ${String(calls).padStart(6)} calls`);
        results.push({ name: location.location_name, calls });
        successCount++;
      }
    }

    // Results
    console.log('\n' + '='.repeat(70));
    console.log('📊 FEBRUARY 2026 - CALL_CLICKS SUMMARY');
    console.log('='.repeat(70));

    results.sort((a, b) => b.calls - a.calls);

    let totalCalls = 0;
    results.forEach((r, idx) => {
      console.log(`${String(idx + 1).padStart(2)}. ${r.name.padEnd(35)} ${String(r.calls).padStart(8)}`);
      totalCalls += r.calls;
    });

    console.log('='.repeat(70));
    console.log(`✅ Total Calls (Feb 2026): ${totalCalls}`);
    console.log(`✅ Success: ${successCount}/${validLocations.length}`);
    if (errorCount > 0) console.log(`❌ Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
