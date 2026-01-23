#!/usr/bin/env ts-node
/**
 * GBP Backfill Script (Simple Version)
 * Fetches data directly from GBP API and uploads to Supabase
 *
 * Prerequisites:
 * - GBP OAuth token must be set up (stored in .oauth-tokens/ or Supabase)
 * - Admin email must be configured in .env.local
 *
 * Usage:
 *   npm install -g ts-node typescript
 *   npx ts-node scripts/gbp-backfill-simple.ts [options]
 *
 * Options:
 *   --year 2024              Year to backfill (default: 2024)
 *   --days-ago 365           Days back to fetch (default: 365)
 *   --dry-run                Preview without uploading
 *   --limit 5                Limit locations (useful for testing)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Parse CLI args
const year = parseInt(
  process.argv.find((a) => a.startsWith('--year'))?.split('=')[1] || '2024'
);
const daysAgo = parseInt(
  process.argv.find((a) => a.startsWith('--days-ago'))?.split('=')[1] || '365'
);
const dryRun = process.argv.includes('--dry-run');
const limit = parseInt(
  process.argv.find((a) => a.startsWith('--limit'))?.split('=')[1] || '999'
);

const API_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

interface LocationData {
  displayName: string;
  name: string; // "locations/XXX"
  accountId?: string;
}

interface DailyMetric {
  gbp_location_id: string;
  date: string;
  views: number;
  actions: number;
  direction_requests: number;
  phone_calls: number;
  website_clicks: number;
  total_reviews: number;
  average_rating: number | null;
}

// Helper: Get access token from file or Supabase
async function getGBPToken(): Promise<string | null> {
  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'gbp_agency_master')
        .single();

      if (!error && data) {
        const tokenData = JSON.parse(data.value);
        if (tokenData.access_token) {
          // Check if expired
          if (tokenData.expiry_date > Date.now()) {
            console.log(`✅ Using GBP token from Supabase`);
            return tokenData.access_token;
          }
        }
      }
    } catch (e) {
      // Continue to local files
    }
  }

  // Try .oauth-tokens folder
  const tokenDir = path.join(process.cwd(), '.oauth-tokens');
  if (fs.existsSync(tokenDir)) {
    const files = fs.readdirSync(tokenDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const tokenPath = path.join(tokenDir, file);
      try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (tokenData.access_token && tokenData.expiry_date > Date.now()) {
          console.log(`✅ Using GBP token from ${file}`);
          return tokenData.access_token;
        }
      } catch (e) {
        // Continue to next file
      }
    }
  }

  console.error(
    '❌ GBP OAuth token not found. Run: npm run auth-gbp to set up'
  );
  return null;
}

// Helper: Fetch GBP locations
async function fetchGBPLocations(token: string): Promise<LocationData[]> {
  try {
    const response = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch accounts:', response.status);
      return [];
    }

    const accountsData = await response.json();
    const locations: LocationData[] = [];

    for (const account of accountsData.accounts || []) {
      try {
        const accountId = account.name.replace('accounts/', '');
        const locsRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (locsRes.ok) {
          const locsData = await locsRes.json();
          for (const loc of locsData.locations || []) {
            locations.push({
              displayName: loc.displayName,
              name: loc.name,
              accountId: accountId,
            });
          }
        }
      } catch (e) {
        console.warn(`⚠️  Could not fetch locations for account`);
      }
    }

    return locations;
  } catch (error) {
    console.error('Error fetching GBP locations:', error);
    return [];
  }
}

// Helper: Fetch performance metrics for a date range
async function fetchPerformanceMetrics(
  locationId: string,
  token: string,
  startDate: string,
  endDate: string
): Promise<DailyMetric[]> {
  const metrics: DailyMetric[] = [];

  // Map metric names to our schema
  const metricMapping: Record<string, keyof DailyMetric> = {
    WEBSITE_CLICKS: 'website_clicks',
    BUSINESS_DIRECTION_REQUESTS: 'direction_requests',
    CALL_CLICKS: 'phone_calls',
  };

  try {
    // Fetch each metric
    for (const [metricName, fieldName] of Object.entries(metricMapping)) {
      const url = new URL(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
      );

      const [startYear, startMonth, startDay] = startDate.split('-');
      const [endYear, endMonth, endDay] = endDate.split('-');

      url.searchParams.set('dailyMetric', metricName);
      url.searchParams.set('dailyRange.start_date.year', startYear);
      url.searchParams.set('dailyRange.start_date.month', startMonth);
      url.searchParams.set('dailyRange.start_date.day', startDay);
      url.searchParams.set('dailyRange.end_date.year', endYear);
      url.searchParams.set('dailyRange.end_date.month', endMonth);
      url.searchParams.set('dailyRange.end_date.day', endDay);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const datedValues = data.timeSeries?.datedValues || [];

        for (const dateValue of datedValues) {
          const date = `${dateValue.date.year}-${String(
            dateValue.date.month
          ).padStart(2, '0')}-${String(dateValue.date.day).padStart(2, '0')}`;
          const value = parseInt(dateValue.value) || 0;

          // Find or create metric entry for this date
          let metric = metrics.find((m) => m.date === date);
          if (!metric) {
            metric = {
              gbp_location_id: locationId,
              date,
              views: 0,
              actions: 0,
              direction_requests: 0,
              phone_calls: 0,
              website_clicks: 0,
              total_reviews: 0,
              average_rating: null,
            };
            metrics.push(metric);
          }

          // Update the metric value
          (metric as any)[fieldName] = value;
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Error fetching metrics for ${locationId}`);
  }

  return metrics;
}

// Helper: Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Main backfill process
async function backfill() {
  console.log('🚀 GBP Backfill Starting...\n');
  console.log(`   API Base: ${API_BASE}`);
  console.log(`   Year: ${year}`);
  console.log(`   Days: ${daysAgo}`);
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`);

  // Get token
  const token = await getGBPToken();
  if (!token) {
    process.exit(1);
  }

  // Fetch locations
  console.log('🌍 Fetching GBP locations...');
  const locations = await fetchGBPLocations(token);

  if (locations.length === 0) {
    console.warn('⚠️  No GBP locations found');
    process.exit(0);
  }

  console.log(`✅ Found ${locations.length} locations\n`);

  // Prepare date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.log(`📅 Date range: ${startDateStr} to ${endDateStr}\n`);

  // Fetch metrics for each location
  const allLocations = [];
  const allMetrics: DailyMetric[] = [];
  let locCount = 0;

  for (const location of locations) {
    if (locCount >= limit) break;
    locCount++;

    console.log(`   📍 ${location.displayName}`);

    // Add to locations list
    allLocations.push({
      client_id: location.accountId || 'unknown',
      gbp_location_id: location.name,
      location_name: location.displayName,
      address: '',
      phone: '',
      website: '',
      business_type: 'Chiropractic',
    });

    // Fetch metrics
    const metrics = await fetchPerformanceMetrics(
      location.name,
      token,
      startDateStr,
      endDateStr
    );

    allMetrics.push(...metrics);
    console.log(`      → ${metrics.length} daily records`);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Fetched data:`);
  console.log(`   Locations: ${allLocations.length}`);
  console.log(`   Daily Metrics: ${allMetrics.length}\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN - Not uploading\n');
    console.log('Sample data:');
    console.log(JSON.stringify(allLocations[0], null, 2));
    console.log('\nTo execute, remove --dry-run flag\n');
    return;
  }

  // Upload to backfill endpoint
  console.log('📤 Uploading to backfill endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}/api/admin/gbp/backfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: allLocations,
        daily_metrics: allMetrics,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Backfill Complete!\n');
      console.log('📊 Upload Results:');
      console.log(
        `   Locations: ${result.results.locations.inserted} inserted, ${result.results.locations.skipped} skipped`
      );
      console.log(
        `   Metrics: ${result.results.daily_metrics.inserted} inserted, ${result.results.daily_metrics.skipped} skipped`
      );

      if (result.results.locations.errors.length > 0) {
        console.log('\n⚠️  Location errors:', result.results.locations.errors);
      }
      if (result.results.daily_metrics.errors.length > 0) {
        console.log(
          `\n⚠️  Metric errors (first 5):`,
          result.results.daily_metrics.errors.slice(0, 5)
        );
      }
    } else {
      console.error('❌ Backfill failed:', result.error);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Upload error:', error.message);
    process.exit(1);
  }

  console.log('\n✨ Done!');
}

// Run
backfill().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
