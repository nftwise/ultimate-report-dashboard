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
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  table: (label, value) => console.log(`  ${label.padEnd(30)} ${colors.bright}${value}${colors.reset}`),
};

async function validateDatabase() {
  console.log('\n');
  console.log(`${colors.bright}🔍 ULTIMATE REPORT DASHBOARD - DATABASE VALIDATION${colors.reset}`);
  console.log(`${colors.cyan}${new Date().toISOString()}${colors.reset}\n`);

  const marchStart = '2026-03-01';
  const today = '2026-04-04';

  log.section('DATABASE STATUS - MARCH 2026 (2026-03-01 to 2026-04-04)');

  try {
    // Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, slug, has_seo, has_ads')
      .order('name');

    if (clientError) {
      log.error(`Failed to fetch clients: ${clientError.message}`);
      process.exit(1);
    }

    log.success(`Found ${clients.length} clients`);
    console.log('');

    // GA4 data
    const { data: ga4, count: ga4Count } = await supabase
      .from('ga4_sessions')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const ga4DateSet = new Set((ga4 || []).map(r => r.date));
    const ga4ClientSet = new Set((ga4 || []).map(r => r.client_id));
    const ga4Dates = Array.from(ga4DateSet).sort();

    log.table('📊 GA4 SESSIONS', '');
    log.table('  Total rows:', ga4Count);
    log.table('  Unique dates:', ga4DateSet.size);
    log.table('  Clients with data:', `${ga4ClientSet.size}/18`);
    log.table('  Date range:', ga4Dates.length > 0 ? `${ga4Dates[0]} → ${ga4Dates[ga4Dates.length - 1]}` : 'N/A');
    log.table('  Coverage:', `${((ga4DateSet.size / 35) * 100).toFixed(1)}%`);
    console.log('');

    // GSC data
    const { data: gsc, count: gscCount } = await supabase
      .from('gsc_queries')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const gscDateSet = new Set((gsc || []).map(r => r.date));
    const gscClientSet = new Set((gsc || []).map(r => r.client_id));
    const gscDates = Array.from(gscDateSet).sort();

    log.table('🔍 GSC QUERIES', '');
    log.table('  Total rows:', gscCount);
    log.table('  Unique dates:', gscDateSet.size);
    log.table('  Clients with data:', gscClientSet.size);
    log.table('  Date range:', gscDates.length > 0 ? `${gscDates[0]} → ${gscDates[gscDates.length - 1]}` : 'N/A');
    log.table('  Coverage:', `${((gscDateSet.size / 35) * 100).toFixed(1)}%`);
    console.log('');

    // Ads campaign data
    const { data: ads, count: adsCount } = await supabase
      .from('ads_campaign_metrics')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const adsDateSet = new Set((ads || []).map(r => r.date));
    const adsClientSet = new Set((ads || []).map(r => r.client_id));
    const adsDates = Array.from(adsDateSet).sort();

    log.table('📈 ADS CAMPAIGN METRICS', '');
    log.table('  Total rows:', adsCount);
    log.table('  Unique dates:', adsDateSet.size);
    log.table('  Clients with data:', adsClientSet.size);
    log.table('  Date range:', adsDates.length > 0 ? `${adsDates[0]} → ${adsDates[adsDates.length - 1]}` : 'N/A');
    log.table('  Coverage:', `${((adsDateSet.size / 35) * 100).toFixed(1)}%`);
    console.log('');

    // GBP data
    const { data: gbp, count: gbpCount } = await supabase
      .from('gbp_location_daily_metrics')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const gbpDateSet = new Set((gbp || []).map(r => r.date));
    const gbpClientSet = new Set((gbp || []).map(r => r.client_id));
    const gbpDates = Array.from(gbpDateSet).sort();

    log.table('🏢 GBP LOCATION METRICS', '');
    log.table('  Total rows:', gbpCount);
    log.table('  Unique dates:', gbpDateSet.size);
    log.table('  Clients with data:', `${gbpClientSet.size}/16`);
    log.table('  Date range:', gbpDates.length > 0 ? `${gbpDates[0]} → ${gbpDates[gbpDates.length - 1]}` : 'N/A');
    log.table('  Coverage:', `${((gbpDateSet.size / 35) * 100).toFixed(1)}%`);
    console.log('');

    // client_metrics_summary
    const { data: summary, count: summaryCount } = await supabase
      .from('client_metrics_summary')
      .select('client_id, date', { count: 'exact' })
      .gte('date', marchStart)
      .lte('date', today);

    const summaryDateSet = new Set((summary || []).map(r => r.date));
    const summaryClientSet = new Set((summary || []).map(r => r.client_id));
    const summaryDates = Array.from(summaryDateSet).sort();

    log.table('📋 CLIENT_METRICS_SUMMARY (Aggregated)', '');
    log.table('  Total rows:', summaryCount);
    log.table('  Unique dates:', summaryDateSet.size);
    log.table('  Clients with data:', summaryClientSet.size);
    log.table('  Date range:', summaryDates.length > 0 ? `${summaryDates[0]} → ${summaryDates[summaryDates.length - 1]}` : 'N/A');
    log.table('  Coverage:', `${((summaryDateSet.size / 35) * 100).toFixed(1)}%`);
    console.log('');

    // Freshness analysis
    log.section('FRESHNESS ANALYSIS');

    const ga4Latest = ga4Dates[ga4Dates.length - 1];
    const gscLatest = gscDates[gscDates.length - 1];
    const adsLatest = adsDates[adsDates.length - 1];
    const gbpLatest = gbpDates[gbpDates.length - 1];

    log.info('API Delay Information:');
    console.log(`  • GA4, GSC, Ads:  ${colors.yellow}1-2 days delay${colors.reset} → expect data up to ${colors.bright}April 2-3${colors.reset}`);
    console.log(`  • GBP:           ${colors.yellow}2-5 days delay${colors.reset} → expect data up to ${colors.bright}March 30 - April 1${colors.reset}`);
    console.log('');

    log.info('Latest data in database:');
    const ga4Status = ga4Latest && ga4Latest >= '2026-04-02' ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
    const gscStatus = gscLatest && gscLatest >= '2026-04-02' ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
    const adsStatus = adsLatest && adsLatest >= '2026-04-02' ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
    const gbpStatus = gbpLatest && gbpLatest >= '2026-03-30' ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;

    console.log(`  ${ga4Status} GA4:   ${ga4Latest || 'N/A'} (expect ≥ 2026-04-02)`);
    console.log(`  ${gscStatus} GSC:   ${gscLatest || 'N/A'} (expect ≥ 2026-04-02)`);
    console.log(`  ${adsStatus} Ads:   ${adsLatest || 'N/A'} (expect ≥ 2026-04-02)`);
    console.log(`  ${gbpStatus} GBP:   ${gbpLatest || 'N/A'} (expect ≥ 2026-03-30)`);
    console.log('');

    // Client-level breakdown
    log.section('CLIENT-LEVEL DATA COVERAGE (Top 10)');

    const ga4ByClient = new Map();
    const adsByClient = new Map();
    const gbpByClient = new Map();

    (ga4 || []).forEach(r => {
      if (!ga4ByClient.has(r.client_id)) ga4ByClient.set(r.client_id, new Set());
      ga4ByClient.get(r.client_id).add(r.date);
    });

    (ads || []).forEach(r => {
      if (!adsByClient.has(r.client_id)) adsByClient.set(r.client_id, new Set());
      adsByClient.get(r.client_id).add(r.date);
    });

    (gbp || []).forEach(r => {
      if (!gbpByClient.has(r.client_id)) gbpByClient.set(r.client_id, new Set());
      gbpByClient.get(r.client_id).add(r.date);
    });

    console.log('');
    const displayClients = clients.slice(0, 10);
    displayClients.forEach(client => {
      const ga4Days = ga4ByClient.get(client.id)?.size || 0;
      const adsays = adsByClient.get(client.id)?.size || 0;
      const gbpDays = gbpByClient.get(client.id)?.size || 0;

      console.log(`  ${colors.bright}${client.name}${colors.reset}`);
      console.log(`    GA4:  ${ga4Days > 0 ? colors.green : colors.yellow}${ga4Days}/35 days${colors.reset}`);
      console.log(`    Ads:  ${adsays > 0 ? colors.green : colors.yellow}${adsays}/35 days${colors.reset}`);
      console.log(`    GBP:  ${gbpDays > 0 ? colors.green : colors.yellow}${gbpDays}/35 days${colors.reset}`);
    });

    // Final status
    log.section('FINAL STATUS');

    const allUpToDate =
      ga4Latest && ga4Latest >= '2026-04-02' &&
      gscLatest && gscLatest >= '2026-04-02' &&
      adsLatest && adsLatest >= '2026-04-02' &&
      gbpLatest && gbpLatest >= '2026-03-30';

    if (allUpToDate) {
      log.success('ALL DATA IS UP TO DATE! ✓✓✓');
      console.log('');
      console.log(`  ${colors.green}${colors.bright}✓${colors.reset} Database is synchronized with expected API delays`);
      console.log(`  ${colors.green}${colors.bright}✓${colors.reset} All data sources have recent data within acceptable ranges`);
    } else {
      log.warn('SOME DATA MAY BE STALE - Verify with APIs');
      console.log('');
      if (!ga4Latest || ga4Latest < '2026-04-02') {
        log.error(`GA4 latest is ${ga4Latest} (expected ≥ 2026-04-02)`);
      }
      if (!gscLatest || gscLatest < '2026-04-02') {
        log.error(`GSC latest is ${gscLatest} (expected ≥ 2026-04-02)`);
      }
      if (!adsLatest || adsLatest < '2026-04-02') {
        log.error(`Ads latest is ${adsLatest} (expected ≥ 2026-04-02)`);
      }
      if (!gbpLatest || gbpLatest < '2026-03-30') {
        log.error(`GBP latest is ${gbpLatest} (expected ≥ 2026-03-30)`);
      }
    }

    console.log('\n');

  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

validateDatabase();
