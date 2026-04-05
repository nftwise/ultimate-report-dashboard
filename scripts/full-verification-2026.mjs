#!/usr/bin/env node
// Full verification script: March 2026 + spot-check all months + ghost clients

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

const MARCH_START = '2026-03-01';
const MARCH_END = '2026-03-31';
const COREPOSTURE_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';

// Ghost client names to check
const GHOST_CLIENT_NAMES = ['Case Animal Hospital', 'Rigel & Rigel', 'Rigel and Rigel'];

const issues = [];

function pct(a, b) {
  if (b === 0 && a === 0) return 0;
  if (b === 0) return 999;
  return Math.abs((a - b) / b) * 100;
}

function flagIf(condition, msg) {
  if (condition) issues.push(msg);
  return condition;
}

// ───────────────────────────────────────────────
// TASK 1: Raw vs Summary comparison (March 2026, all clients)
// ───────────────────────────────────────────────
async function task1_rawVsSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TASK 1: RAW vs SUMMARY — March 2026, All Clients           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1a. Get all clients from summary
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, slug')
    .order('name');

  if (!clients?.length) { console.log('ERROR: No clients found'); return; }
  console.log(`Total clients in DB: ${clients.length}\n`);

  // 1b. Aggregate summary March per client
  const { data: summaryRows } = await supabase
    .from('client_metrics_summary')
    .select('client_id, sessions, users, seo_clicks, ad_spend, gbp_calls')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END);

  const summaryByClient = {};
  for (const row of summaryRows || []) {
    if (!summaryByClient[row.client_id]) {
      summaryByClient[row.client_id] = { sessions: 0, users: 0, seo_clicks: 0, ad_spend: 0, gbp_calls: 0 };
    }
    const s = summaryByClient[row.client_id];
    s.sessions += row.sessions || 0;
    s.users += row.users || 0;
    s.seo_clicks += row.seo_clicks || 0;
    s.ad_spend += parseFloat(row.ad_spend || 0);
    s.gbp_calls += row.gbp_calls || 0;
  }

  // 1c. Aggregate raw tables March per client
  // GA4 sessions (non-all rows)
  const { data: ga4Raw } = await supabase
    .from('ga4_sessions')
    .select('client_id, sessions')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END)
    .neq('source_medium', '(all) / (all)');

  const ga4SessionsByClient = {};
  for (const row of ga4Raw || []) {
    ga4SessionsByClient[row.client_id] = (ga4SessionsByClient[row.client_id] || 0) + (row.sessions || 0);
  }

  // GA4 users from (all)/(all) aggregate rows
  const { data: ga4AllRows } = await supabase
    .from('ga4_sessions')
    .select('client_id, total_users')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END)
    .eq('source_medium', '(all) / (all)');

  const ga4UsersByClient = {};
  for (const row of ga4AllRows || []) {
    ga4UsersByClient[row.client_id] = (ga4UsersByClient[row.client_id] || 0) + (row.total_users || 0);
  }

  // GSC daily summary
  const { data: gscRaw } = await supabase
    .from('gsc_daily_summary')
    .select('client_id, total_clicks')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END);

  const gscByClient = {};
  for (const row of gscRaw || []) {
    gscByClient[row.client_id] = (gscByClient[row.client_id] || 0) + (row.total_clicks || 0);
  }

  // Ads cost
  const { data: adsRaw } = await supabase
    .from('ads_campaign_metrics')
    .select('client_id, cost')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END);

  const adsByClient = {};
  for (const row of adsRaw || []) {
    adsByClient[row.client_id] = (adsByClient[row.client_id] || 0) + parseFloat(row.cost || 0);
  }

  // GBP phone_calls
  const { data: gbpRaw } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, phone_calls')
    .gte('date', MARCH_START)
    .lte('date', MARCH_END);

  const gbpByClient = {};
  for (const row of gbpRaw || []) {
    gbpByClient[row.client_id] = (gbpByClient[row.client_id] || 0) + (row.phone_calls || 0);
  }

  // 1d. Print comparison table
  const header = 'Client'.padEnd(28) +
    'GA4sess(raw)'.padStart(13) + 'GA4sess(sum)'.padStart(13) + 'Diff%'.padStart(7) + ' | ' +
    'Users(raw)'.padStart(11) + 'Users(sum)'.padStart(11) + 'Diff%'.padStart(7) + ' | ' +
    'GSC(raw)'.padStart(9) + 'GSC(sum)'.padStart(9) + 'Diff%'.padStart(7) + ' | ' +
    'Ads(raw)'.padStart(10) + 'Ads(sum)'.padStart(10) + 'Diff%'.padStart(7) + ' | ' +
    'GBP(raw)'.padStart(9) + 'GBP(sum)'.padStart(9) + 'Diff%'.padStart(7);
  console.log(header);
  console.log('─'.repeat(header.length));

  let flaggedRows = [];

  for (const client of clients) {
    const s = summaryByClient[client.id] || { sessions: 0, users: 0, seo_clicks: 0, ad_spend: 0, gbp_calls: 0 };
    const rawSessions = ga4SessionsByClient[client.id] || 0;
    const rawUsers = ga4UsersByClient[client.id] || 0;
    const rawGsc = gscByClient[client.id] || 0;
    const rawAds = adsByClient[client.id] || 0;
    const rawGbp = gbpByClient[client.id] || 0;

    const dSess = pct(rawSessions, s.sessions);
    const dUsers = pct(rawUsers, s.users);
    const dGsc = pct(rawGsc, s.seo_clicks);
    const dAds = pct(rawAds, s.ad_spend);
    const dGbp = pct(rawGbp, s.gbp_calls);

    const anyData = rawSessions > 0 || rawUsers > 0 || rawGsc > 0 || rawAds > 0 || rawGbp > 0 ||
                    s.sessions > 0 || s.users > 0 || s.seo_clicks > 0 || s.ad_spend > 0 || s.gbp_calls > 0;

    if (!anyData) continue; // skip clients with no data at all

    const THRESHOLD = 2;
    const flags = [];
    if (dSess > THRESHOLD && (rawSessions > 0 || s.sessions > 0)) flags.push(`GA4sess:${dSess.toFixed(1)}%`);
    if (dUsers > THRESHOLD && (rawUsers > 0 || s.users > 0)) flags.push(`Users:${dUsers.toFixed(1)}%`);
    if (dGsc > THRESHOLD && (rawGsc > 0 || s.seo_clicks > 0)) flags.push(`GSC:${dGsc.toFixed(1)}%`);
    if (dAds > THRESHOLD && (rawAds > 0 || s.ad_spend > 0)) flags.push(`Ads:${dAds.toFixed(1)}%`);
    if (dGbp > THRESHOLD && (rawGbp > 0 || s.gbp_calls > 0)) flags.push(`GBP:${dGbp.toFixed(1)}%`);

    const flag = flags.length > 0 ? ' ⚠ ' + flags.join(', ') : '';

    const line = client.name.substring(0,27).padEnd(28) +
      rawSessions.toString().padStart(13) + s.sessions.toString().padStart(13) + (dSess.toFixed(1)+'%').padStart(7) + ' | ' +
      rawUsers.toString().padStart(11) + s.users.toString().padStart(11) + (dUsers.toFixed(1)+'%').padStart(7) + ' | ' +
      rawGsc.toString().padStart(9) + s.seo_clicks.toString().padStart(9) + (dGsc.toFixed(1)+'%').padStart(7) + ' | ' +
      rawAds.toFixed(0).padStart(10) + s.ad_spend.toFixed(0).padStart(10) + (dAds.toFixed(1)+'%').padStart(7) + ' | ' +
      rawGbp.toString().padStart(9) + s.gbp_calls.toString().padStart(9) + (dGbp.toFixed(1)+'%').padStart(7) +
      flag;

    console.log(line);

    if (flags.length > 0) {
      flaggedRows.push({ client: client.name, flags });
      flags.forEach(f => issues.push(`[Task1] ${client.name}: ${f}`));
    }
  }

  console.log('\n--- TASK 1 FLAGS (>2% discrepancy) ---');
  if (flaggedRows.length === 0) {
    console.log('✓ No discrepancies >2% found');
  } else {
    flaggedRows.forEach(r => console.log(`⚠  ${r.client}: ${r.flags.join(', ')}`));
  }
}

// ───────────────────────────────────────────────
// TASK 2: 12-month coverage check
// ───────────────────────────────────────────────
async function task2_coverageCheck() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TASK 2: 12-MONTH COVERAGE — Apr 2025 → Mar 2026            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const months = [];
  for (let m = 4; m <= 12; m++) months.push({ year: 2025, month: m });
  for (let m = 1; m <= 3; m++) months.push({ year: 2026, month: m });

  function monthRange(y, m) {
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
    return { start, end, days: lastDay };
  }

  const header = 'Month'.padEnd(10) +
    'GA4(all)(cli)'.padStart(14) + 'GA4allDays'.padStart(11) +
    'GSC(cli)'.padStart(9) + 'GSCdays'.padStart(8) +
    'ADS(cli)'.padStart(9) + 'ADSdays'.padStart(8) +
    'GBP(cli)'.padStart(9) + 'GBPdays'.padStart(8);
  console.log(header);
  console.log('─'.repeat(header.length));

  for (const { year, month } of months) {
    const { start, end, days } = monthRange(year, month);
    const label = `${year}-${String(month).padStart(2,'0')}`;

    // GA4: count clients with (all)/(all) rows
    const { data: ga4 } = await supabase
      .from('ga4_sessions')
      .select('client_id, date')
      .gte('date', start)
      .lte('date', end)
      .eq('source_medium', '(all) / (all)');

    const ga4Clients = new Set((ga4||[]).map(r => r.client_id)).size;
    const ga4Days = new Set((ga4||[]).map(r => r.date)).size;

    // GSC daily summary
    const { data: gsc } = await supabase
      .from('gsc_daily_summary')
      .select('client_id, date')
      .gte('date', start)
      .lte('date', end);

    const gscClients = new Set((gsc||[]).map(r => r.client_id)).size;
    const gscDays = new Set((gsc||[]).map(r => r.date)).size;

    // ADS
    const { data: ads } = await supabase
      .from('ads_campaign_metrics')
      .select('client_id, date')
      .gte('date', start)
      .lte('date', end);

    const adsClients = new Set((ads||[]).map(r => r.client_id)).size;
    const adsDays = new Set((ads||[]).map(r => r.date)).size;

    // GBP
    const { data: gbp } = await supabase
      .from('gbp_location_daily_metrics')
      .select('client_id, date')
      .gte('date', start)
      .lte('date', end);

    const gbpClients = new Set((gbp||[]).map(r => r.client_id)).size;
    const gbpDays = new Set((gbp||[]).map(r => r.date)).size;

    // Flag months with poor coverage
    if (ga4Days < days * 0.5 && ga4Clients > 0) issues.push(`[Task2] ${label}: GA4 only ${ga4Days}/${days} days`);
    if (gscDays < days * 0.5 && gscClients > 0) issues.push(`[Task2] ${label}: GSC only ${gscDays}/${days} days`);

    console.log(
      label.padEnd(10) +
      `${ga4Clients}c/${ga4Days}d`.padStart(14) + `${ga4Days}/${days}`.padStart(11) +
      `${gscClients}c`.padStart(9) + `${gscDays}/${days}`.padStart(8) +
      `${adsClients}c`.padStart(9) + `${adsDays}/${days}`.padStart(8) +
      `${gbpClients}c`.padStart(9) + `${gbpDays}/${days}`.padStart(8)
    );
  }

  // CorePosture spot-check
  console.log(`\n--- CorePosture Spot-check (${COREPOSTURE_ID}) ---`);
  const cpHeader = 'Month'.padEnd(10) + 'GA4days'.padStart(8) + 'GSCdays'.padStart(8) + 'ADSdays'.padStart(8) + 'GBPdays'.padStart(8);
  console.log(cpHeader);

  for (const { year, month } of months) {
    const { start, end, days } = monthRange(year, month);
    const label = `${year}-${String(month).padStart(2,'0')}`;

    const [{ data: cp_ga4 }, { data: cp_gsc }, { data: cp_ads }, { data: cp_gbp }] = await Promise.all([
      supabase.from('ga4_sessions').select('date').gte('date', start).lte('date', end).eq('client_id', COREPOSTURE_ID).eq('source_medium', '(all) / (all)'),
      supabase.from('gsc_daily_summary').select('date').gte('date', start).lte('date', end).eq('client_id', COREPOSTURE_ID),
      supabase.from('ads_campaign_metrics').select('date').gte('date', start).lte('date', end).eq('client_id', COREPOSTURE_ID),
      supabase.from('gbp_location_daily_metrics').select('date').gte('date', start).lte('date', end).eq('client_id', COREPOSTURE_ID),
    ]);

    const d_ga4 = new Set((cp_ga4||[]).map(r => r.date)).size;
    const d_gsc = new Set((cp_gsc||[]).map(r => r.date)).size;
    const d_ads = new Set((cp_ads||[]).map(r => r.date)).size;
    const d_gbp = new Set((cp_gbp||[]).map(r => r.date)).size;

    const flags = [];
    if (d_ga4 < days * 0.7) flags.push('GA4_GAPS');
    if (d_gsc < days * 0.5) flags.push('GSC_GAPS');
    if (d_gbp < days * 0.5) flags.push('GBP_GAPS');

    console.log(
      label.padEnd(10) +
      `${d_ga4}/${days}`.padStart(8) +
      `${d_gsc}/${days}`.padStart(8) +
      `${d_ads}/${days}`.padStart(8) +
      `${d_gbp}/${days}`.padStart(8) +
      (flags.length ? ' ⚠ ' + flags.join(', ') : ' ✓')
    );

    if (flags.length) flags.forEach(f => issues.push(`[Task2] CorePosture ${label}: ${f}`));
  }
}

// ───────────────────────────────────────────────
// TASK 3: Live API spot-check (3 clients)
// ───────────────────────────────────────────────
async function task3_apiSpotCheck() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TASK 3: LIVE API SPOT-CHECK (3 clients)                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const slugs = ['coreposture', 'whole-body-wellness', 'decarlo-chiro'];
  const baseUrl = 'https://ultimate-report-dashboard.vercel.app';

  for (const slug of slugs) {
    console.log(`\n── ${slug} ──`);

    // Try gbp-check endpoint
    try {
      const url = `${baseUrl}/api/debug/gbp-check?slug=${slug}&start=2026-03-01&end=2026-03-31`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      console.log(`  GBP-check (${res.status}): ${text.substring(0, 300)}`);
      if (res.status !== 200) {
        issues.push(`[Task3] ${slug}: gbp-check returned ${res.status}`);
      }
    } catch (e) {
      console.log(`  GBP-check: ERROR - ${e.message}`);
      issues.push(`[Task3] ${slug}: gbp-check failed - ${e.message}`);
    }

    // Try compare-march endpoint
    try {
      const url = `${baseUrl}/api/admin/compare-march?client=${slug}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      console.log(`  compare-march (${res.status}): ${text.substring(0, 300)}`);
      if (res.status !== 200) {
        // 401/404 are OK if endpoint doesn't exist
        if (res.status !== 401 && res.status !== 404) {
          issues.push(`[Task3] ${slug}: compare-march returned ${res.status}`);
        } else {
          console.log(`  compare-march: ${res.status} (endpoint may require auth or not exist)`);
        }
      }
    } catch (e) {
      console.log(`  compare-march: ERROR - ${e.message}`);
    }

    // Direct DB check for this client
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle();

    if (clientRow) {
      console.log(`  Client in DB: ${clientRow.name} (${clientRow.id})`);

      const { data: summaryCheck } = await supabase
        .from('client_metrics_summary')
        .select('date, sessions, users, seo_clicks, ad_spend, gbp_calls')
        .eq('client_id', clientRow.id)
        .gte('date', MARCH_START)
        .lte('date', MARCH_END)
        .order('date', { ascending: false })
        .limit(5);

      console.log(`  Summary rows (last 5 of March):`);
      if (!summaryCheck?.length) {
        console.log('    ⚠  NO ROWS in summary for March 2026!');
        issues.push(`[Task3] ${slug}: no summary rows for March 2026`);
      } else {
        summaryCheck.forEach(r => console.log(`    ${r.date}: sess=${r.sessions} users=${r.users} gsc=${r.seo_clicks} ads=${parseFloat(r.ad_spend||0).toFixed(2)} gbp=${r.gbp_calls}`));
      }
    } else {
      console.log(`  ⚠  Client "${slug}" not found in DB!`);
      issues.push(`[Task3] ${slug}: client not found in DB`);
    }
  }
}

// ───────────────────────────────────────────────
// TASK 4: Ghost clients check
// ───────────────────────────────────────────────
async function task4_ghostClients() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TASK 4: GHOST CLIENTS — March 2026                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Find ghost clients by name
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, slug');

  const ghostCandidates = (allClients || []).filter(c =>
    GHOST_CLIENT_NAMES.some(g => c.name.toLowerCase().includes(g.toLowerCase().replace(' & ', '').replace(' and ', '')))
  );

  console.log(`Ghost client name patterns: ${GHOST_CLIENT_NAMES.join(', ')}`);
  console.log(`Found ${ghostCandidates.length} matching clients in clients table:`);
  ghostCandidates.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  if (ghostCandidates.length === 0) {
    console.log('  ✓ No ghost clients found in clients table\n');
  }

  // More thorough search
  console.log('\nSearching clients table for ghost names...');
  const ghostNames = ['case animal', 'rigel'];
  for (const term of ghostNames) {
    const { data } = await supabase
      .from('clients')
      .select('id, name, slug')
      .ilike('name', `%${term}%`);

    if (data?.length) {
      console.log(`\n  Clients matching "${term}":`);
      for (const c of data) {
        console.log(`    - "${c.name}" slug="${c.slug}" id=${c.id}`);

        // Check if they have March 2026 data
        const { count: sumCount } = await supabase
          .from('client_metrics_summary')
          .select('date', { count: 'exact' })
          .eq('client_id', c.id)
          .gte('date', MARCH_START)
          .lte('date', MARCH_END);

        if (sumCount > 0) {
          console.log(`      ⚠  HAS ${sumCount} rows in client_metrics_summary for March 2026!`);
          issues.push(`[Task4] Ghost client "${c.name}" still has ${sumCount} rows in summary for March 2026`);
        } else {
          console.log(`      ✓ No rows in client_metrics_summary for March 2026`);
        }

        // Also check raw tables
        const { count: ga4Count } = await supabase
          .from('ga4_sessions')
          .select('date', { count: 'exact' })
          .eq('client_id', c.id)
          .gte('date', MARCH_START)
          .lte('date', MARCH_END);

        if (ga4Count > 0) {
          console.log(`      ⚠  HAS ${ga4Count} GA4 rows for March 2026`);
          issues.push(`[Task4] Ghost client "${c.name}" has ${ga4Count} GA4 rows for March 2026`);
        }

        const { count: gbpCount } = await supabase
          .from('gbp_location_daily_metrics')
          .select('date', { count: 'exact' })
          .eq('client_id', c.id)
          .gte('date', MARCH_START)
          .lte('date', MARCH_END);

        if (gbpCount > 0) {
          console.log(`      ⚠  HAS ${gbpCount} GBP rows for March 2026`);
          issues.push(`[Task4] Ghost client "${c.name}" has ${gbpCount} GBP rows for March 2026`);
        }
      }
    } else {
      console.log(`  ✓ No clients found matching "${term}"`);
    }
  }
}

// ───────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(70));
  console.log('  FULL DATA VERIFICATION — Ultimate Report Dashboard');
  console.log(`  Run date: ${new Date().toISOString()}`);
  console.log('═'.repeat(70));

  await task1_rawVsSummary();
  await task2_coverageCheck();
  await task3_apiSpotCheck();
  await task4_ghostClients();

  // Final verdict
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FINAL VERDICT                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (issues.length === 0) {
    console.log('✓ PASS — No issues found across all 4 tasks.\n');
  } else {
    console.log(`✗ FAIL — ${issues.length} issue(s) found:\n`);
    issues.forEach((iss, i) => console.log(`  ${i + 1}. ${iss}`));
  }

  console.log('\n' + '═'.repeat(70));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
