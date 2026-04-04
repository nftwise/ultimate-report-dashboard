import { createClient } from '@supabase/supabase-js';
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
  section: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`  ${msg}`),
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

  log.info(`Found ${clients?.length || 0} clients`);
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
  const today_date = new Date('2026-04-04');
  const march1 = new Date('2026-03-01');
  const daysElapsed = Math.floor((today_date.getTime() - march1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  log.info(`Period: March 1 - April 4, 2026 (${daysElapsed} days)`);
  log.info('');
  log.info('Expected Freshness (accounting for API delays):');
  log.info('  • GA4, GSC, Ads: 1-2 days delay → expect data up to April 2-3');
  log.info('  • GBP: 2-5 days delay → expect data up to March 30 - April 1');
  console.log('');

  const datasets = [
    { name: 'GA4', dates: ga4DateRange, expected: 35, minExpected: 33 },
    { name: 'GSC', dates: gscDateRange, expected: 35, minExpected: 33 },
    { name: 'Ads', dates: adsDateRange, expected: 35, minExpected: 33 },
    { name: 'GBP', dates: gbpDateRange, expected: 35, minExpected: 30 },
  ];

  datasets.forEach(({ name, dates, minExpected }) => {
    const coverage = ((dates.size / minExpected) * 100).toFixed(1);
    let status = '✓ GOOD';
    if (dates.size < minExpected - 2) {
      status = '⚠ NEEDS CHECK';
    }

    console.log(`  ${name}: ${dates.size}/${minExpected} days (${coverage}%) ${status}`);
  });

  return {
    ga4,
    gsc,
    ads,
    gbp,
    summary,
    clients,
    ga4DateRange,
    gscDateRange,
    adsDateRange,
    gbpDateRange,
  };
}

async function analyzeGaps(dbData) {
  log.section('DETAILED GAP ANALYSIS BY CLIENT');

  const { clients, ga4, gsc, ads, gbp } = dbData;

  // Find clients with SEO enabled
  const seoClients = clients?.filter(c => c.has_seo) || [];
  const adsClients = clients?.filter(c => c.has_ads) || [];
  const gbpClients = clients?.filter(c => c.has_gbp) || [];

  console.log('');
  log.info('GA4 Coverage by Client:');
  const ga4ByClient = new Map<string, Set<string>>();
  ga4?.forEach(r => {
    if (!ga4ByClient.has(r.client_id)) ga4ByClient.set(r.client_id, new Set());
    ga4ByClient.get(r.client_id)!.add(r.date);
  });

  seoClients.slice(0, 5).forEach(client => {
    const dates = ga4ByClient.get(client.id) || new Set();
    const status = dates.size > 32 ? '✓' : '⚠';
    log.info(`  ${status} ${client.name}: ${dates.size} days of data`);
  });

  console.log('');
  log.info('Ads Coverage by Client:');
  const adsByClient = new Map<string, Set<string>>();
  ads?.forEach(r => {
    if (!adsByClient.has(r.client_id)) adsByClient.set(r.client_id, new Set());
    adsByClient.get(r.client_id)!.add(r.date);
  });

  adsClients.slice(0, 5).forEach(client => {
    const dates = adsByClient.get(client.id) || new Set();
    const status = dates.size > 32 ? '✓' : '⚠';
    log.info(`  ${status} ${client.name}: ${dates.size} days of data`);
  });

  console.log('');
  log.info('GBP Coverage by Client:');
  const gbpByClient = new Map<string, Set<string>>();
  gbp?.forEach(r => {
    if (!gbpByClient.has(r.client_id)) gbpByClient.set(r.client_id, new Set());
    gbpByClient.get(r.client_id)!.add(r.date);
  });

  gbpClients.slice(0, 5).forEach(client => {
    const dates = gbpByClient.get(client.id) || new Set();
    const status = dates.size > 29 ? '✓' : '⚠';
    log.info(`  ${status} ${client.name}: ${dates.size} days of data`);
  });
}

async function main() {
  console.log('\n🔍 ULTIMATE REPORT DASHBOARD - DATA VALIDATION REPORT\n');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Report Date: 2026-04-04`);
  console.log('Target Period: March 1 - April 4, 2026\n');

  try {
    const dbData = await getDBStats();
    if (dbData) {
      await analyzeGaps(dbData);

      log.section('FINAL SUMMARY & STATUS');

      const ga4Latest = Array.from(dbData.ga4DateRange).sort().pop();
      const gscLatest = Array.from(dbData.gscDateRange).sort().pop();
      const adsLatest = Array.from(dbData.adsDateRange).sort().pop();
      const gbpLatest = Array.from(dbData.gbpDateRange).sort().pop();

      console.log('');
      log.info('Latest Data in Database:');
      log.info(`  GA4: ${ga4Latest || 'N/A'}`);
      log.info(`  GSC: ${gscLatest || 'N/A'}`);
      log.info(`  Ads: ${adsLatest || 'N/A'}`);
      log.info(`  GBP: ${gbpLatest || 'N/A'}`);

      console.log('');
      log.info('Expected vs Actual:');
      const ga4Expected = ga4Latest && ga4Latest >= '2026-04-02';
      const gscExpected = gscLatest && gscLatest >= '2026-04-02';
      const adsExpected = adsLatest && adsLatest >= '2026-04-02';
      const gbpExpected = gbpLatest && gbpLatest >= '2026-03-30';

      console.log(`  GA4: ${ga4Latest} ${ga4Expected ? '✓' : '⚠'} (expect >= 2026-04-02)`);
      console.log(`  GSC: ${gscLatest} ${gscExpected ? '✓' : '⚠'} (expect >= 2026-04-02)`);
      console.log(`  Ads: ${adsLatest} ${adsExpected ? '✓' : '⚠'} (expect >= 2026-04-02)`);
      console.log(`  GBP: ${gbpLatest} ${gbpExpected ? '✓' : '⚠'} (expect >= 2026-03-30)`);

      console.log('');
      if (ga4Expected && gscExpected && adsExpected && gbpExpected) {
        log.success('✓ ALL DATA IS UP TO DATE!');
      } else {
        log.warn('⚠ SOME DATA MAY BE STALE - Verify with APIs');
      }
    }
  } catch (error) {
    log.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  }
}

main();
