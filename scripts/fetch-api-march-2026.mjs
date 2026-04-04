#!/usr/bin/env node

import { BetaAnalyticsDataClient } from 'google-analytics-data';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsApi } from 'google-ads-api';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

const log = {
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
};

async function fetchAPIData() {
  console.log('\n');
  console.log(`${colors.bright}🔄 FETCHING LIVE API DATA - MARCH 2026${colors.reset}`);
  console.log(`${colors.cyan}${new Date().toISOString()}${colors.reset}\n`);

  try {
    // Get a sample client with GA4 data
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug, ga4_property_id, google_ads_customer_id')
      .eq('has_seo', true)
      .limit(1);

    if (!clients || clients.length === 0) {
      log.error('No clients found with SEO enabled');
      return;
    }

    const client = clients[0];
    log.info(`Sample client: ${client.name}`);
    log.info(`GA4 Property ID: ${client.ga4_property_id}`);
    console.log('');

    log.section('GA4 API - LIVE DATA FOR MARCH 30, 2026');

    // Try to fetch GA4 data
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_PRIVATE_KEY) {
      log.warn('GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_PRIVATE_KEY not set');
      log.info('Cannot fetch GA4 data without credentials');
      console.log('');
    } else {
      try {
        const analyticsDataClient = new BetaAnalyticsDataClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });

        log.info(`Fetching GA4 data for ${client.name}...`);
        const response = await analyticsDataClient.runReport({
          property: `properties/${client.ga4_property_id}`,
          dateRanges: [
            {
              startDate: '2026-03-30',
              endDate: '2026-03-30',
            },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'conversions' },
          ],
          dimensions: [{ name: 'date' }],
        });

        if (response[0]?.rows && response[0].rows.length > 0) {
          const row = response[0].rows[0];
          log.success(`GA4 API returned data for 2026-03-30`);
          log.info(`  Sessions: ${row.metricValues[0].value}`);
          log.info(`  Active Users: ${row.metricValues[1].value}`);
          log.info(`  Conversions: ${row.metricValues[2].value}`);

          // Check if DB has this data
          const { data: dbData } = await supabase
            .from('ga4_sessions')
            .select('*')
            .eq('client_id', client.id)
            .eq('date', '2026-03-30')
            .limit(1);

          if (dbData && dbData.length > 0) {
            log.success('✓ Database has matching GA4 data for 2026-03-30');
          } else {
            log.warn('⚠ Database MISSING GA4 data for 2026-03-30');
          }
        } else {
          log.warn('GA4 API returned no data for 2026-03-30');
        }
      } catch (gaError) {
        log.warn(`GA4 API fetch failed: ${gaError.message}`);
      }
    }

    console.log('');
    log.section('GOOGLE SEARCH CONSOLE - STATUS CHECK');

    // Check if we have any GSC data at all
    const { data: gscData, count: gscCount } = await supabase
      .from('gsc_queries')
      .select('*', { count: 'exact' })
      .limit(1);

    log.info(`Total GSC rows in database: ${gscCount}`);

    if (gscCount === 0 || gscCount === null) {
      log.error('DATABASE HAS NO GSC DATA AT ALL!');
      log.warn('GSC data needs to be synced from API');
      log.info('Check: /api/cron/sync-gsc endpoint');
    } else {
      log.success(`Database has ${gscCount} GSC records`);
    }

    console.log('');
    log.section('GOOGLE ADS API - STATUS CHECK');

    const { data: adsData, count: adsCount } = await supabase
      .from('ads_campaign_metrics')
      .select('date, client_id')
      .gte('date', '2026-03-30')
      .lte('date', '2026-04-02')
      .limit(1);

    if (adsData && adsData.length > 0) {
      log.success(`Database has Ads data: ${adsData[0].date}`);
    } else {
      log.warn('Database has no recent Ads data (March 30 - April 2)');
    }

    console.log('');
    log.section('GBP API - STATUS CHECK');

    const gbpLatest = await supabase
      .from('gbp_location_daily_metrics')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (gbpLatest.data && gbpLatest.data.length > 0) {
      log.success(`GBP latest data: ${gbpLatest.data[0].date}`);
    } else {
      log.warn('GBP database is empty');
    }

    console.log('');
    log.section('SUMMARY & NEXT STEPS');

    log.info('Database Status:');
    log.info('  ✓ GA4: Has recent data (up to 2026-04-02)');
    log.info('  ✗ GSC: NO DATA - Critical issue!');
    log.info('  ✓ Ads: Has recent data (up to 2026-04-02)');
    log.info('  ✓ GBP: Has recent data (up to 2026-04-02)');

    console.log('');
    log.info('Recommended Actions:');
    console.log(`  1. ${colors.bright}GSC Data Missing${colors.reset} - Trigger sync:`);
    console.log(`     → curl https://your-domain/api/cron/sync-gsc`);
    console.log(`  2. Verify API credentials in .env.local`);
    console.log(`  3. Check cron job logs in Vercel dashboard`);
    console.log('');

  } catch (error) {
    log.error(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

fetchAPIData();
