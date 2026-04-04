#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { BetaAnalyticsDataClient } from 'google-analytics-data';
import { GoogleAdsApi } from 'google-ads-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Color console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`  ${msg}`),
};

async function getDBStats() {
  log.section('DATABASE STATUS - MARCH 2026 (2026-03-01 to 2026-04-04)');

  const marchStart = '2026-03-01';
  const today = '2026-04-04';

  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug, has_seo, has_ads, has_gbp');

  if (clientError) {
    log.error(`Failed to fetch clients: ${clientError.message}`);
    return;
  }

  log.info(`Found ${clients.length} clients`);
  console.log('');

  // Check GA4 data
  log.info('📊 GA4 SESSIONS DATA:');
  const { data: ga4, count: ga4Count } = await supabase
    .from('ga4_sessions')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const ga4DateRange = new Set(ga4?.map(r => r.date) || []);
  const ga4Clients = new Set(ga4?.map(r => r.client_id) || []);
  log.info(`  Rows: ${ga4Count} | Unique dates: ${ga4DateRange.size} | Clients with data: ${ga4Clients.size}/18`);
  if (ga4DateRange.size > 0) {
    const dates = Array.from(ga4DateRange).sort();
    log.info(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  // Check GSC data
  log.info('🔍 GSC QUERIES DATA:');
  const { data: gsc, count: gscCount } = await supabase
    .from('gsc_queries')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const gscDateRange = new Set(gsc?.map(r => r.date) || []);
  const gscClients = new Set(gsc?.map(r => r.client_id) || []);
  log.info(`  Rows: ${gscCount} | Unique dates: ${gscDateRange.size} | Clients with data: ${gscClients.size}`);
  if (gscDateRange.size > 0) {
    const dates = Array.from(gscDateRange).sort();
    log.info(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  // Check Ads campaign data
  log.info('📈 ADS CAMPAIGN DATA:');
  const { data: ads, count: adsCount } = await supabase
    .from('ads_campaign_metrics')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const adsDateRange = new Set(ads?.map(r => r.date) || []);
  const adsClients = new Set(ads?.map(r => r.client_id) || []);
  log.info(`  Rows: ${adsCount} | Unique dates: ${adsDateRange.size} | Clients with data: ${adsClients.size}`);
  if (adsDateRange.size > 0) {
    const dates = Array.from(adsDateRange).sort();
    log.info(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  // Check GBP data (from gbp_location_daily_metrics)
  log.info('🏢 GBP LOCATION DATA:');
  const { data: gbp, count: gbpCount } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, date, location_id', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const gbpDateRange = new Set(gbp?.map(r => r.date) || []);
  const gbpClients = new Set(gbp?.map(r => r.client_id) || []);
  log.info(`  Rows: ${gbpCount} | Unique dates: ${gbpDateRange.size} | Clients with data: ${gbpClients.size}/16`);
  if (gbpDateRange.size > 0) {
    const dates = Array.from(gbpDateRange).sort();
    log.info(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  // Check client_metrics_summary (aggregated)
  log.info('📋 CLIENT_METRICS_SUMMARY (Aggregated):');
  const { data: summary, count: summaryCount } = await supabase
    .from('client_metrics_summary')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const summaryDateRange = new Set(summary?.map(r => r.date) || []);
  const summaryClients = new Set(summary?.map(r => r.client_id) || []);
  log.info(`  Rows: ${summaryCount} | Unique dates: ${summaryDateRange.size} | Clients with data: ${summaryClients.size}`);
  if (summaryDateRange.size > 0) {
    const dates = Array.from(summaryDateRange).sort();
    log.info(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  console.log('');
  log.section('FRESHNESS ANALYSIS');

  // Calculate expected vs actual days
  const marchDays = 35; // March 1-31 + 4 days of April
  const today_date = new Date('2026-04-04');
  const march1 = new Date('2026-03-01');
  const daysElapsed = Math.floor((today_date - march1) / (1000 * 60 * 60 * 24)) + 1;

  log.info(`Expected days with data: ${daysElapsed} (March 1 - April 4, 2026)`);
  log.info('');
  log.info('API Delay Information:');
  log.info('  • GA4, GSC, Ads: 1-2 days delay (should have data up to April 2-3)');
  log.info('  • GBP: 2-5 days delay (should have data up to March 30 - April 1)');
  console.log('');

  const datasets = [
    { name: 'GA4', dates: ga4DateRange, expected: 33 },
    { name: 'GSC', dates: gscDateRange, expected: 33 },
    { name: 'Ads', dates: adsDateRange, expected: 33 },
    { name: 'GBP', dates: gbpDateRange, expected: 31 },
  ];

  datasets.forEach(({ name, dates, expected }) => {
    const coverage = ((dates.size / expected) * 100).toFixed(1);
    const status =
      name === 'GBP'
        ? dates.size >= 28 ? '✓ GOOD' : '⚠ NEEDS CHECK'
        : dates.size >= 31 ? '✓ GOOD' : '⚠ NEEDS CHECK';

    log.info(`${name}: ${dates.size}/${expected} days (${coverage}%) ${status}`);
  });

  return {
    ga4,
    gsc,
    ads,
    gbp,
    summary,
    clients,
  };
}

async function fetchFromAPIs(dbData) {
  log.section('FETCHING LIVE API DATA FOR COMPARISON');

  const { clients } = dbData;

  // We'll fetch for a sample client and specific dates to validate
  const sampleClient = clients.find(c => c.has_seo && c.has_ads);

  if (!sampleClient) {
    log.error('No sample client found with both SEO and Ads data');
    return;
  }

  log.info(`Sample client: ${sampleClient.name} (${sampleClient.slug})`);
  log.info(`GA4 Property ID: ${sampleClient.ga4_property_id}`);
  log.info(`Ads Customer ID: ${sampleClient.google_ads_customer_id}`);
  console.log('');

  // Fetch GA4 sample data for March 30, 2026
  try {
    log.info('Attempting GA4 API fetch for March 30, 2026...');
    const analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    const response = await analyticsDataClient.runReport({
      property: `properties/${sampleClient.ga4_property_id}`,
      dateRanges: [
        {
          startDate: '2026-03-30',
          endDate: '2026-03-30',
        },
      ],
      metrics: [{ name: 'sessions' }, { name: 'users' }, { name: 'conversions' }],
    });

    if (response[0]?.rows?.length > 0) {
      const row = response[0].rows[0];
      log.success(`GA4 returned data: sessions=${row.metricValues[0].value}, users=${row.metricValues[1].value}`);

      // Check if this data is in DB
      const dbRow = dbData.ga4.find(r => r.client_id === sampleClient.id && r.date === '2026-03-30');
      if (dbRow) {
        log.success(`Database has matching GA4 row for 2026-03-30`);
      } else {
        log.warn(`Database MISSING GA4 row for 2026-03-30`);
      }
    } else {
      log.warn('GA4 API returned no rows for 2026-03-30');
    }
  } catch (error) {
    log.warn(`GA4 API check failed: ${error.message}`);
  }

  console.log('');
  log.section('SUMMARY & RECOMMENDATIONS');

  const ga4Latest = Array.from(dbData.ga4.map(r => r.date)).sort().pop();
  const gscLatest = Array.from(dbData.gsc.map(r => r.date)).sort().pop();
  const adsLatest = Array.from(dbData.ads.map(r => r.date)).sort().pop();
  const gbpLatest = Array.from(dbData.gbp.map(r => r.date)).sort().pop();

  log.info('Latest data in database:');
  log.info(`  GA4: ${ga4Latest || 'N/A'}`);
  log.info(`  GSC: ${gscLatest || 'N/A'}`);
  log.info(`  Ads: ${adsLatest || 'N/A'}`);
  log.info(`  GBP: ${gbpLatest || 'N/A'}`);
  console.log('');

  log.info('Expected freshness (accounting for API delays):');
  log.info(`  GA4/GSC/Ads: Should be at April 2-3 (1-2 day delay from today Apr 4)`);
  log.info(`  GBP: Should be at March 30 - April 1 (2-5 day delay)`);
  console.log('');

  // Determine status
  const ga4OK = ga4Latest >= '2026-04-02';
  const gscOK = gscLatest >= '2026-04-02';
  const adsOK = adsLatest >= '2026-04-02';
  const gbpOK = gbpLatest >= '2026-03-30';

  if (ga4OK && gscOK && adsOK && gbpOK) {
    log.success('✓ ALL DATA IS UP TO DATE');
  } else {
    log.warn('⚠ SOME DATA MAY BE STALE - CHECK THESE:');
    if (!ga4OK) log.error(`  GA4 latest is ${ga4Latest} (expected >= 2026-04-02)`);
    if (!gscOK) log.error(`  GSC latest is ${gscLatest} (expected >= 2026-04-02)`);
    if (!adsOK) log.error(`  Ads latest is ${adsLatest} (expected >= 2026-04-02)`);
    if (!gbpOK) log.error(`  GBP latest is ${gbpLatest} (expected >= 2026-03-30)`);
  }
}

async function main() {
  console.log('\n🔍 ULTIMATE REPORT DASHBOARD - DATA VALIDATION\n');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Current Date: 2026-04-04`);

  try {
    const dbData = await getDBStats();
    if (dbData) {
      await fetchFromAPIs(dbData);
    }
  } catch (error) {
    log.error(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
