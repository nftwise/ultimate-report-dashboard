#!/usr/bin/env ts-node
/**
 * GBP Backfill Script
 * Fetches data from Google Business Profile API and uploads to Supabase
 *
 * Usage:
 *   npx ts-node scripts/gbp-backfill.ts [--year 2024] [--clients client1,client2] [--dry-run]
 *
 * Examples:
 *   npx ts-node scripts/gbp-backfill.ts --year 2024
 *   npx ts-node scripts/gbp-backfill.ts --year 2024 --dry-run
 *   npx ts-node scripts/gbp-backfill.ts --clients "Client A,Client B"
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Types
interface GBPLocation {
  client_id: string;
  gbp_location_id: string;
  location_name: string;
  address?: string;
  phone?: string;
  website?: string;
  business_type?: string;
}

interface DailyMetric {
  gbp_location_id: string;
  date: string;
  views?: number;
  actions?: number;
  direction_requests?: number;
  phone_calls?: number;
  website_clicks?: number;
  total_reviews?: number;
  new_reviews_today?: number;
  average_rating?: number;
  business_photo_views?: number;
  customer_photo_count?: number;
  customer_photo_views?: number;
  posts_count?: number;
  posts_views?: number;
  posts_actions?: number;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const year = parseInt(args.find(a => a.startsWith('--year'))?.split('=')[1] || '2024');
const clientFilter = args.find(a => a.startsWith('--clients'))?.split('=')[1]?.split(',').map(c => c.trim());
const dryRun = args.includes('--dry-run');
const daysPerBatch = 30; // Fetch 30 days at a time to avoid rate limits

console.log(`🚀 GBP Backfill Script Starting...`);
console.log(`   Year: ${year}`);
console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}`);
if (clientFilter) console.log(`   Clients: ${clientFilter.join(', ')}`);
console.log('');

// Helper: Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: Generate date ranges for the year
function generateDateRanges(year: number, daysPerRange: number = daysPerBatch) {
  const ranges = [];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  let current = new Date(startDate);
  while (current <= endDate) {
    const rangeStart = new Date(current);
    const rangeEnd = new Date(current);
    rangeEnd.setDate(rangeEnd.getDate() + daysPerRange - 1);

    if (rangeEnd > endDate) {
      rangeEnd.setTime(endDate.getTime());
    }

    ranges.push({
      start: formatDate(rangeStart),
      end: formatDate(rangeEnd),
    });

    current.setDate(current.getDate() + daysPerRange);
  }

  return ranges;
}

// Fetch GBP data
async function fetchGBPData() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  console.log(`📡 Base URL: ${baseUrl}\n`);

  // Step 1: Get all clients
  console.log('📋 Fetching clients list...');
  const clientsRes = await fetch(`${baseUrl}/api/admin/check-clients`);
  const clientsData = await clientsRes.json();

  if (!clientsData.success || !clientsData.clients) {
    console.error('❌ Failed to fetch clients');
    process.exit(1);
  }

  let clients = clientsData.clients;
  if (clientFilter) {
    clients = clients.filter((c: any) =>
      clientFilter.some(
        (f) =>
          c.name.toLowerCase().includes(f.toLowerCase()) ||
          c.id.toLowerCase().includes(f.toLowerCase())
      )
    );
  }

  console.log(`✅ Found ${clients.length} clients\n`);

  // Step 2: Get GBP locations for each client
  console.log('🌍 Fetching GBP locations...');
  const gbpLocations: GBPLocation[] = [];

  for (const client of clients) {
    try {
      const locRes = await fetch(
        `${baseUrl}/api/admin/list-gbp-locations?clientId=${client.id}`
      );
      const locData = await locRes.json();

      if (locData.success && locData.locations) {
        for (const loc of locData.locations) {
          gbpLocations.push({
            client_id: client.id,
            gbp_location_id: loc.accountId || loc.id,
            location_name: loc.accountName || client.name,
            address: loc.address,
            phone: loc.phone,
            website: loc.website,
            business_type: 'Chiropractic',
          });
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not fetch locations for ${client.name}`);
    }
  }

  if (gbpLocations.length === 0) {
    console.warn('⚠️  No GBP locations found. Make sure to set up GBP OAuth first.');
    console.log('   Run: npm run auth-gbp\n');
    process.exit(0);
  }

  console.log(`✅ Found ${gbpLocations.length} GBP locations\n`);

  // Step 3: Fetch daily metrics for each location
  console.log(`📊 Fetching daily metrics for year ${year}...`);
  const dateRanges = generateDateRanges(year, daysPerBatch);
  const dailyMetrics: DailyMetric[] = [];
  let metricsCount = 0;

  for (const location of gbpLocations) {
    console.log(`   📍 ${location.location_name}`);

    for (const range of dateRanges) {
      try {
        // Fetch metrics for this date range
        const metricsRes = await fetch(
          `${baseUrl}/api/dashboard/gbp-metrics?` +
            `locationId=${location.gbp_location_id}` +
            `&startDate=${range.start}` +
            `&endDate=${range.end}`
        );

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          if (metricsData.dailyData && Array.isArray(metricsData.dailyData)) {
            for (const daily of metricsData.dailyData) {
              dailyMetrics.push({
                gbp_location_id: location.gbp_location_id,
                date: daily.date,
                views: daily.views || 0,
                actions: daily.actions || 0,
                direction_requests: daily.directionRequests || 0,
                phone_calls: daily.phoneCalls || 0,
                website_clicks: daily.websiteClicks || 0,
                total_reviews: daily.totalReviews || 0,
                average_rating: daily.averageRating || null,
              });
              metricsCount++;
            }
          }
        }
      } catch (err) {
        console.warn(`      ⚠️  Failed to fetch ${range.start} to ${range.end}`);
      }

      // Rate limiting: wait a bit between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Fetched ${metricsCount} daily metrics\n`);

  // Step 4: Upload to backfill endpoint
  if (!dryRun) {
    console.log('📤 Uploading to Supabase...\n');

    const payload = {
      locations: gbpLocations,
      daily_metrics: dailyMetrics,
    };

    try {
      const uploadRes = await fetch(`${baseUrl}/api/admin/gbp/backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const uploadData = await uploadRes.json();

      if (uploadData.success) {
        console.log('✅ Backfill Complete!\n');
        console.log('📊 Results:');
        console.log(
          `   Locations: ${uploadData.results.locations.inserted} inserted`
        );
        console.log(
          `   Daily Metrics: ${uploadData.results.daily_metrics.inserted} inserted`
        );
        if (uploadData.results.locations.errors.length > 0) {
          console.log('   Errors:', uploadData.results.locations.errors);
        }
      } else {
        console.error('❌ Upload failed:', uploadData.error);
        process.exit(1);
      }
    } catch (err: any) {
      console.error('❌ Upload error:', err.message);
      process.exit(1);
    }
  } else {
    console.log('🔍 DRY RUN - Not uploading\n');
    console.log('📊 Summary:');
    console.log(`   Locations: ${gbpLocations.length}`);
    console.log(`   Daily Metrics: ${dailyMetrics.length}`);
    console.log('\nTo execute, remove --dry-run flag\n');
  }

  console.log('✨ Done!');
}

// Run
fetchGBPData().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
