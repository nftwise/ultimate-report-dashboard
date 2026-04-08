import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const MARCH_START = '2026-03-01';
const MARCH_END = '2026-03-31';

// Generate all dates in March 2026
function getMarchDates() {
  const dates = [];
  for (let d = 1; d <= 31; d++) {
    dates.push(`2026-03-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

const ALL_MARCH_DATES = getMarchDates();

// Fetch all rows for a table with pagination (Supabase max 1000 per request)
async function fetchAll(table, filters = {}, columns = '*') {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(columns)
      .gte('date', MARCH_START)
      .lte('date', MARCH_END)
      .range(offset, offset + PAGE_SIZE - 1);

    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

async function queryGBP(clientId) {
  // gbp_location_daily_metrics has client_id directly
  const rows = await fetchAll(
    'gbp_location_daily_metrics',
    { client_id: clientId },
    'date, phone_calls, website_clicks, direction_requests, views'
  );

  if (!rows || rows.length === 0) {
    return { calls: 0, views: 0, websiteClicks: 0, directions: 0, daysRecorded: 0, missingDates: ALL_MARCH_DATES };
  }

  const recordedDates = [...new Set(rows.map(r => r.date))].sort();
  const missingDates = ALL_MARCH_DATES.filter(d => !recordedDates.includes(d));

  const totals = rows.reduce((acc, r) => ({
    calls: acc.calls + (r.phone_calls || 0),
    views: acc.views + (r.views || 0),
    websiteClicks: acc.websiteClicks + (r.website_clicks || 0),
    directions: acc.directions + (r.direction_requests || 0),
  }), { calls: 0, views: 0, websiteClicks: 0, directions: 0 });

  return {
    ...totals,
    daysRecorded: recordedDates.length,
    missingDates
  };
}

async function queryGA4(clientId) {
  // ga4_sessions has multiple rows per date (by source_medium, device, etc.)
  // Use total_users column (not 'users')
  const rows = await fetchAll(
    'ga4_sessions',
    { client_id: clientId },
    'date, sessions, total_users, new_users'
  );

  if (!rows || rows.length === 0) {
    return { sessions: 0, users: 0, newUsers: 0, daysRecorded: 0 };
  }

  const recordedDates = [...new Set(rows.map(r => r.date))];
  const totals = rows.reduce((acc, r) => ({
    sessions: acc.sessions + (r.sessions || 0),
    users: acc.users + (r.total_users || 0),
    newUsers: acc.newUsers + (r.new_users || 0),
  }), { sessions: 0, users: 0, newUsers: 0 });

  return { ...totals, daysRecorded: recordedDates.length };
}

async function queryGSC(clientId) {
  // gsc_queries has per-query rows; sum all for total clicks/impressions
  const rows = await fetchAll(
    'gsc_queries',
    { client_id: clientId },
    'date, clicks, impressions'
  );

  if (!rows || rows.length === 0) {
    return { clicks: 0, impressions: 0, daysRecorded: 0 };
  }

  const recordedDates = [...new Set(rows.map(r => r.date))];
  const totals = rows.reduce((acc, r) => ({
    clicks: acc.clicks + (r.clicks || 0),
    impressions: acc.impressions + (r.impressions || 0),
  }), { clicks: 0, impressions: 0 });

  return { ...totals, daysRecorded: recordedDates.length };
}

async function queryAds(clientId) {
  const rows = await fetchAll(
    'ads_campaign_metrics',
    { client_id: clientId },
    'date, cost, clicks, conversions, impressions'
  );

  if (!rows || rows.length === 0) {
    return { spend: 0, clicks: 0, conversions: 0, impressions: 0, daysRecorded: 0 };
  }

  const recordedDates = [...new Set(rows.map(r => r.date))];
  const totals = rows.reduce((acc, r) => ({
    spend: acc.spend + (r.cost || 0),
    clicks: acc.clicks + (r.clicks || 0),
    conversions: acc.conversions + (r.conversions || 0),
    impressions: acc.impressions + (r.impressions || 0),
  }), { spend: 0, clicks: 0, conversions: 0, impressions: 0 });

  return {
    spend: Math.round(totals.spend * 100) / 100,
    clicks: totals.clicks,
    conversions: Math.round(totals.conversions * 100) / 100,
    impressions: totals.impressions,
    daysRecorded: recordedDates.length
  };
}

async function querySummary(clientId) {
  // client_metrics_summary uses: sessions, ad_spend, seo_clicks, gbp_calls, gbp_profile_views, etc.
  const rows = await fetchAll(
    'client_metrics_summary',
    { client_id: clientId },
    'gbp_calls, gbp_profile_views, gbp_website_clicks, gbp_directions, sessions, seo_clicks, ad_spend'
  );

  if (!rows || rows.length === 0) {
    return { gbp_calls: 0, gbp_views: 0, gbp_website_clicks: 0, gbp_directions: 0, total_sessions: 0, seo_clicks: 0, total_spend: 0 };
  }

  const totals = rows.reduce((acc, r) => ({
    gbp_calls: acc.gbp_calls + (r.gbp_calls || 0),
    gbp_views: acc.gbp_views + (r.gbp_profile_views || 0),
    gbp_website_clicks: acc.gbp_website_clicks + (r.gbp_website_clicks || 0),
    gbp_directions: acc.gbp_directions + (r.gbp_directions || 0),
    total_sessions: acc.total_sessions + (r.sessions || 0),
    seo_clicks: acc.seo_clicks + (r.seo_clicks || 0),
    total_spend: acc.total_spend + (r.ad_spend || 0),
  }), { gbp_calls: 0, gbp_views: 0, gbp_website_clicks: 0, gbp_directions: 0, total_sessions: 0, seo_clicks: 0, total_spend: 0 });

  return {
    ...totals,
    total_spend: Math.round(totals.total_spend * 100) / 100
  };
}

async function main() {
  console.log('Fetching all active clients...');

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, slug, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching clients:', error);
    process.exit(1);
  }

  console.log(`Found ${clients.length} active clients\n`);

  const result = {
    generated_at: new Date().toISOString(),
    period: 'March 2026 (2026-03-01 to 2026-03-31)',
    clients: []
  };

  for (const client of clients) {
    process.stdout.write(`Processing ${client.name}... `);

    const [gbp, ga4, gsc, ads, summary] = await Promise.all([
      queryGBP(client.id),
      queryGA4(client.id),
      queryGSC(client.id),
      queryAds(client.id),
      querySummary(client.id),
    ]);

    console.log('done');

    result.clients.push({
      id: client.id,
      name: client.name,
      slug: client.slug,
      gbp,
      ga4,
      gsc,
      ads,
      summary
    });
  }

  writeFileSync('/tmp/db_march_2026.json', JSON.stringify(result, null, 2));
  console.log('\nJSON saved to /tmp/db_march_2026.json');

  // Print human-readable table
  console.log('\n' + '='.repeat(200));
  console.log('MARCH 2026 DATA SUMMARY - ALL ACTIVE CLIENTS');
  console.log('='.repeat(200));

  const header = [
    'Client'.padEnd(38),
    'GBP Days'.padStart(8),
    'Calls'.padStart(6),
    'Views'.padStart(6),
    'WebClk'.padStart(7),
    'Dirs'.padStart(5),
    'GA4 Days'.padStart(8),
    'Sessions'.padStart(9),
    'Users'.padStart(7),
    'GSC Days'.padStart(9),
    'GSC Clicks'.padStart(11),
    'Impressions'.padStart(12),
    'Ads Days'.padStart(9),
    'Spend($)'.padStart(10),
    'AdsClks'.padStart(8),
    'Convrs'.padStart(7),
    'SumSess'.padStart(8),
    'SumSpend'.padStart(9),
  ].join(' ');

  console.log(header);
  console.log('-'.repeat(200));

  for (const c of result.clients) {
    const row = [
      c.name.substring(0, 38).padEnd(38),
      String(c.gbp.daysRecorded).padStart(8),
      String(c.gbp.calls).padStart(6),
      String(c.gbp.views).padStart(6),
      String(c.gbp.websiteClicks).padStart(7),
      String(c.gbp.directions).padStart(5),
      String(c.ga4.daysRecorded).padStart(8),
      String(c.ga4.sessions).padStart(9),
      String(c.ga4.users).padStart(7),
      String(c.gsc.daysRecorded).padStart(9),
      String(c.gsc.clicks).padStart(11),
      String(c.gsc.impressions).padStart(12),
      String(c.ads.daysRecorded).padStart(9),
      String(c.ads.spend).padStart(10),
      String(c.ads.clicks).padStart(8),
      String(c.ads.conversions).padStart(7),
      String(c.summary.total_sessions).padStart(8),
      String(c.summary.total_spend).padStart(9),
    ].join(' ');
    console.log(row);

    if (c.gbp.missingDates && c.gbp.missingDates.length > 0 && c.gbp.missingDates.length < 31) {
      const missing = c.gbp.missingDates;
      console.log(`  GBP missing ${missing.length} days: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` ... +${missing.length - 8} more` : ''}`);
    }
  }

  console.log('='.repeat(200));

  // Totals row
  const totals = result.clients.reduce((acc, c) => ({
    gbp_calls: acc.gbp_calls + c.gbp.calls,
    gbp_views: acc.gbp_views + c.gbp.views,
    ga4_sessions: acc.ga4_sessions + c.ga4.sessions,
    ga4_users: acc.ga4_users + c.ga4.users,
    gsc_clicks: acc.gsc_clicks + c.gsc.clicks,
    gsc_impressions: acc.gsc_impressions + c.gsc.impressions,
    ads_spend: acc.ads_spend + c.ads.spend,
    ads_clicks: acc.ads_clicks + c.ads.clicks,
    ads_conversions: acc.ads_conversions + c.ads.conversions,
  }), { gbp_calls: 0, gbp_views: 0, ga4_sessions: 0, ga4_users: 0, gsc_clicks: 0, gsc_impressions: 0, ads_spend: 0, ads_clicks: 0, ads_conversions: 0 });

  console.log('\nTOTALS ACROSS ALL CLIENTS:');
  console.log(`GBP: ${totals.gbp_calls} calls | ${totals.gbp_views} views`);
  console.log(`GA4: ${totals.ga4_sessions} sessions | ${totals.ga4_users} users`);
  console.log(`GSC: ${totals.gsc_clicks} clicks | ${totals.gsc_impressions.toLocaleString()} impressions`);
  console.log(`Ads: $${Math.round(totals.ads_spend * 100) / 100} spend | ${totals.ads_clicks} clicks | ${Math.round(totals.ads_conversions * 100) / 100} conversions`);

  console.log(`\nTotal active clients: ${result.clients.length}`);

  // Data coverage summary
  console.log('\nDATA COVERAGE:');
  const gbpClients = result.clients.filter(c => c.gbp.daysRecorded > 0);
  const ga4Clients = result.clients.filter(c => c.ga4.daysRecorded > 0);
  const gscClients = result.clients.filter(c => c.gsc.daysRecorded > 0);
  const adsClients = result.clients.filter(c => c.ads.daysRecorded > 0);
  console.log(`GBP: ${gbpClients.length}/${result.clients.length} clients have data`);
  console.log(`GA4: ${ga4Clients.length}/${result.clients.length} clients have data`);
  console.log(`GSC: ${gscClients.length}/${result.clients.length} clients have data`);
  console.log(`Ads: ${adsClients.length}/${result.clients.length} clients have data`);
}

main().catch(console.error);
