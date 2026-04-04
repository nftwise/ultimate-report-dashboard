#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

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
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}╔══ ${msg} ══╗${colors.reset}`),
  subsection: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  table: (label, value) => console.log(`  ${label.padEnd(35)} ${colors.bright}${value}${colors.reset}`),
};

async function getDataSummary() {
  const marchStart = '2026-03-01';
  const today = '2026-04-04';

  const summary = {
    ga4: { rows: 0, dates: 0, clients: 0, range: null },
    gsc: { rows: 0, dates: 0, clients: 0, range: null },
    ads: { rows: 0, dates: 0, clients: 0, range: null },
    gbp: { rows: 0, dates: 0, clients: 0, range: null },
    aggregated: { rows: 0, dates: 0, clients: 0, range: null },
  };

  // GA4
  const { data: ga4, count: ga4Count } = await supabase
    .from('ga4_sessions')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const ga4Dates = Array.from(new Set((ga4 || []).map(r => r.date))).sort();
  summary.ga4 = {
    rows: ga4Count,
    dates: ga4Dates.length,
    clients: new Set((ga4 || []).map(r => r.client_id)).size,
    range: ga4Dates.length > 0 ? `${ga4Dates[0]} → ${ga4Dates[ga4Dates.length - 1]}` : null,
    latest: ga4Dates[ga4Dates.length - 1],
  };

  // GSC
  const { data: gsc, count: gscCount } = await supabase
    .from('gsc_queries')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const gscDates = Array.from(new Set((gsc || []).map(r => r.date))).sort();
  summary.gsc = {
    rows: gscCount,
    dates: gscDates.length,
    clients: new Set((gsc || []).map(r => r.client_id)).size,
    range: gscDates.length > 0 ? `${gscDates[0]} → ${gscDates[gscDates.length - 1]}` : null,
    latest: gscDates[gscDates.length - 1],
  };

  // Ads
  const { data: ads, count: adsCount } = await supabase
    .from('ads_campaign_metrics')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const adsDates = Array.from(new Set((ads || []).map(r => r.date))).sort();
  summary.ads = {
    rows: adsCount,
    dates: adsDates.length,
    clients: new Set((ads || []).map(r => r.client_id)).size,
    range: adsDates.length > 0 ? `${adsDates[0]} → ${adsDates[adsDates.length - 1]}` : null,
    latest: adsDates[adsDates.length - 1],
  };

  // GBP
  const { data: gbp, count: gbpCount } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const gbpDates = Array.from(new Set((gbp || []).map(r => r.date))).sort();
  summary.gbp = {
    rows: gbpCount,
    dates: gbpDates.length,
    clients: new Set((gbp || []).map(r => r.client_id)).size,
    range: gbpDates.length > 0 ? `${gbpDates[0]} → ${gbpDates[gbpDates.length - 1]}` : null,
    latest: gbpDates[gbpDates.length - 1],
  };

  // Aggregated
  const { data: agg, count: aggCount } = await supabase
    .from('client_metrics_summary')
    .select('client_id, date', { count: 'exact' })
    .gte('date', marchStart)
    .lte('date', today);

  const aggDates = Array.from(new Set((agg || []).map(r => r.date))).sort();
  summary.aggregated = {
    rows: aggCount,
    dates: aggDates.length,
    clients: new Set((agg || []).map(r => r.client_id)).size,
    range: aggDates.length > 0 ? `${aggDates[0]} → ${aggDates[aggDates.length - 1]}` : null,
    latest: aggDates[aggDates.length - 1],
  };

  return summary;
}

async function validate() {
  console.log('\n');
  console.log(`${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║     ULTIMATE REPORT DASHBOARD - DATA VALIDATION    ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║         March 1 - April 4, 2026 (35 days)        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.cyan}Report Generated: ${new Date().toISOString()}${colors.reset}\n`);

  try {
    const summary = await getDataSummary();

    log.section('DATABASE FRESHNESS CHECK');
    console.log('');

    // Display each data source
    const sources = [
      {
        name: '📊 GA4 SESSIONS',
        key: 'ga4',
        expected: 33,
        minFresh: '2026-04-02',
        delay: '1-2 days',
      },
      {
        name: '🔍 GSC QUERIES',
        key: 'gsc',
        expected: 33,
        minFresh: '2026-04-02',
        delay: '1-2 days',
      },
      {
        name: '📈 ADS CAMPAIGNS',
        key: 'ads',
        expected: 33,
        minFresh: '2026-04-02',
        delay: '1-2 days',
      },
      {
        name: '🏢 GBP LOCATIONS',
        key: 'gbp',
        expected: 35,
        minFresh: '2026-03-30',
        delay: '2-5 days',
      },
      {
        name: '📋 AGGREGATED',
        key: 'aggregated',
        expected: 35,
        minFresh: '2026-04-02',
        delay: 'varies',
      },
    ];

    sources.forEach(src => {
      const data = summary[src.key];
      const fresh = data.latest && data.latest >= src.minFresh;
      const status = fresh ? `${colors.green}✓ FRESH${colors.reset}` : `${colors.yellow}⚠ STALE${colors.reset}`;

      console.log(`${src.name}`);
      log.table('  Rows in period:', data.rows || '0');
      log.table('  Unique dates:', `${data.dates}/${src.expected}`);
      log.table('  Clients with data:', data.clients || '0');
      log.table('  Date range:', data.range || 'N/A');
      log.table('  Latest date:', `${data.latest || 'N/A'} [API delay: ${src.delay}]`);
      log.table('  Status:', status);
      console.log('');
    });

    log.section('OVERALL ASSESSMENT');

    const allFresh =
      summary.ga4.latest >= '2026-04-02' &&
      summary.gsc.latest >= '2026-04-02' &&
      summary.ads.latest >= '2026-04-02' &&
      summary.gbp.latest >= '2026-03-30';

    if (allFresh) {
      log.success('All data sources are up to date within expected API delays!');
      console.log('');
      log.info('System is operating normally. All cron jobs appear to be executing successfully.');
    } else {
      log.warn('One or more data sources are stale. Investigation required:');
      console.log('');

      if (!summary.ga4.latest || summary.ga4.latest < '2026-04-02') {
        log.error(`GA4: Latest is ${summary.ga4.latest} (expected ≥ 2026-04-02)`);
        log.info('  → Check: /api/cron/sync-ga4');
      }

      if (!summary.gsc.latest || summary.gsc.latest < '2026-04-02') {
        log.error(`GSC: Latest is ${summary.gsc.latest} (expected ≥ 2026-04-02)`);
        log.info('  → Check: /api/cron/sync-gsc');
      }

      if (!summary.ads.latest || summary.ads.latest < '2026-04-02') {
        log.error(`Ads: Latest is ${summary.ads.latest} (expected ≥ 2026-04-02)`);
        log.info('  → Check: /api/cron/sync-ads');
      }

      if (!summary.gbp.latest || summary.gbp.latest < '2026-03-30') {
        log.error(`GBP: Latest is ${summary.gbp.latest} (expected ≥ 2026-03-30)`);
        log.info('  → Check: /api/cron/sync-gbp');
      }
    }

    console.log('');
    log.section('CRITICAL ISSUES DETECTED');

    if (summary.gsc.rows === 0) {
      log.error('GSC DATABASE IS COMPLETELY EMPTY!');
      console.log('');
      console.log(`  ${colors.bright}Action Required:${colors.reset}`);
      console.log(`  1. Verify Google Search Console API credentials`);
      console.log(`  2. Check Vercel cron logs for /api/cron/sync-gsc`);
      console.log(`  3. Manually trigger: curl https://your-domain/api/cron/sync-gsc?cron_secret=XXX`);
      console.log('');
    }

    // Data completeness check
    const expectedClients = 18; // GA4 clients
    const gscCompletenessIssue = summary.gsc.rows === 0;
    const gaCompletenessIssue = summary.ga4.clients < 3;
    const adsCompletenessIssue = summary.ads.clients < 4;

    if (gscCompletenessIssue || gaCompletenessIssue || adsCompletenessIssue) {
      log.warn('Client Coverage Issues:');
      if (gaCompletenessIssue)
        log.error(`  GA4: Only ${summary.ga4.clients} clients have data (expected ~18)`);
      if (adsCompletenessIssue)
        log.error(`  Ads: Only ${summary.ads.clients} clients have data (expected ~10+)`);
      if (gscCompletenessIssue) log.error(`  GSC: No clients have data (expected ~15+)`);
      console.log('');
    }

    log.section('RECOMMENDATIONS');

    console.log('');
    console.log(`${colors.bright}1. Verify Cron Jobs:${colors.reset}`);
    console.log('   → Check Vercel dashboard > Functions > Cron');
    console.log('   → Crons run daily at 10:00-10:20 UTC');
    console.log('');

    console.log(`${colors.bright}2. For Missing/Stale Data:${colors.reset}`);
    console.log('   → Check environment variables in Vercel');
    console.log('   → Verify API credentials (GA4, Ads, GSC, GBP)');
    console.log('   → Check rate limits on external APIs');
    console.log('');

    console.log(`${colors.bright}3. For GSC Specifically:${colors.reset}`);
    console.log('   → Must enable Google Search Console API');
    console.log('   → Must add service account to GSC property');
    console.log('   → Check /api/cron/sync-gsc endpoint manually');
    console.log('');

    console.log(`${colors.bright}Next Steps:${colors.reset}`);
    console.log('   1. Verify all environment variables are set');
    console.log('   2. Check cron execution logs in Vercel');
    console.log('   3. For stale data, trigger manual sync endpoints');
    console.log('   4. Monitor data within next 24 hours');
    console.log('');

  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

validate();
