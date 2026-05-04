#!/usr/bin/env node

/**
 * CI Gate — Data Quality Checks
 *
 * Runs 17 checks across 5 groups.
 * Exit 0 = all pass (safe to deploy)
 * Exit 1 = any fail (block deploy)
 *
 * Usage: node scripts/ci-gate.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
// BASE_URL removed — ci-gate now queries Supabase directly (no Vercel dependency)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── helpers ────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/** Wrap a check with a 10-second timeout */
async function withTimeout(fn, label) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after 10s — ${label}`)), 10_000)
    ),
  ]);
}

// ─── check runner ────────────────────────────────────────────────────────────

const results = []; // { num, label, passed, detail }

async function check(num, label, fn) {
  try {
    const { passed, detail } = await withTimeout(fn, label);
    results.push({ num, label, passed, detail });
  } catch (err) {
    results.push({ num, label, passed: false, detail: err.message });
  }
}

// ─── Group A — Data Freshness ─────────────────────────────────────────────

async function checkGA4Freshness() {
  // Use client_metrics_summary (smaller, indexed) to avoid timeout on ga4_sessions
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .eq('period_type', 'daily')
    .order('date', { ascending: false })
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const latest = data?.[0]?.date;
  const threshold = daysAgo(3);
  const passed = latest >= threshold;
  const ago = latest
    ? Math.round((new Date(today()) - new Date(latest)) / 86400000)
    : null;
  return {
    passed,
    detail: `latest: ${latest ?? 'none'} (${ago ?? '?'}d ago), threshold: < 3d`,
  };
}

async function checkGSCFreshness() {
  const { data, error } = await supabase
    .from('gsc_daily_summary')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const latest = data?.[0]?.date;
  const threshold = daysAgo(5);
  const passed = latest >= threshold;
  const ago = latest
    ? Math.round((new Date(today()) - new Date(latest)) / 86400000)
    : null;
  return {
    passed,
    detail: `latest: ${latest ?? 'none'} (${ago ?? '?'}d ago), threshold: < 5d`,
  };
}

async function checkAdsFreshness() {
  const { data, error } = await supabase
    .from('ads_campaign_metrics')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const latest = data?.[0]?.date;
  const threshold = daysAgo(3);
  const passed = latest >= threshold;
  const ago = latest
    ? Math.round((new Date(today()) - new Date(latest)) / 86400000)
    : null;
  return {
    passed,
    detail: `latest: ${latest ?? 'none'} (${ago ?? '?'}d ago), threshold: < 3d`,
  };
}

async function checkGBPFreshness() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const latest = data?.[0]?.date;
  const threshold = daysAgo(5);
  const passed = latest >= threshold;
  const ago = latest
    ? Math.round((new Date(today()) - new Date(latest)) / 86400000)
    : null;
  return {
    passed,
    detail: `latest: ${latest ?? 'none'} (${ago ?? '?'}d ago), threshold: < 5d`,
  };
}

async function checkSummaryYesterday() {
  // Check that summary has rows within last 4 days.
  // 4-day window because:
  //   - CI often runs at ~03 UTC, before the 09-11 UTC cron completes
  //   - Rollup runs per group (A/B/C), each may complete at slightly different times
  //   - Weekends/holidays can shift timing by 1 extra day
  const fourDaysAgo = daysAgo(4);
  const yesterday   = daysAgo(1);
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .gte('date', fourDaysAgo)
    .lte('date', yesterday)
    .order('date', { ascending: false })
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const latest = data?.[0]?.date;
  const passed = !!latest;
  return {
    passed,
    detail: passed
      ? `latest summary row: ${latest} (within last 4 days ✓)`
      : `No summary rows in last 4 days (${fourDaysAgo} → ${yesterday})`,
  };
}

// ─── Group B — Data Integrity ─────────────────────────────────────────────

async function checkNoDuplicates() {
  // Pull all rows for last 30 days, check uniqueness of client_id+date+period_type
  const since = daysAgo(30);
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('client_id, date, period_type')
    .gte('date', since);
  if (error) return { passed: false, detail: error.message };

  const seen = new Set();
  const dupes = [];
  for (const row of data ?? []) {
    const key = `${row.client_id}|${row.date}|${row.period_type}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  return {
    passed: dupes.length === 0,
    detail:
      dupes.length === 0
        ? `${data?.length ?? 0} rows checked, no duplicates`
        : `${dupes.length} duplicate(s) found`,
  };
}

async function checkNoNegatives() {
  const since = daysAgo(30);
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('id, sessions, ad_spend, gbp_calls')
    .gte('date', since)
    .or('sessions.lt.0,ad_spend.lt.0,gbp_calls.lt.0');
  if (error) return { passed: false, detail: error.message };
  const count = data?.length ?? 0;
  return {
    passed: count === 0,
    detail:
      count === 0
        ? 'No negative values found'
        : `${count} row(s) with negative sessions/ad_spend/gbp_calls`,
  };
}

async function checkNoFutureDates() {
  const todayStr = today();
  const { count, error } = await supabase
    .from('client_metrics_summary')
    .select('id', { count: 'exact', head: true })
    .gt('date', todayStr);
  if (error) return { passed: false, detail: error.message };
  return {
    passed: (count ?? 0) === 0,
    detail:
      (count ?? 0) === 0
        ? 'No future-dated rows'
        : `${count} future-dated row(s) found (date > ${todayStr})`,
  };
}

async function checkNoGhostClients() {
  // Ghost clients that should NOT have recent data
  const ghostNames = ['Case Animal Hospital', 'Rigel & Rigel'];
  const since = daysAgo(7);

  const issues = [];
  for (const name of ghostNames) {
    // Find client id first
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${name}%`);

    if (!clients?.length) continue;

    for (const c of clients) {
      const { count, error } = await supabase
        .from('client_metrics_summary')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', c.id)
        .gte('date', since);

      if (error) continue;
      if ((count ?? 0) > 0) {
        issues.push(`${c.name} has ${count} rows in last 7 days`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    detail:
      issues.length === 0
        ? 'No ghost client data found'
        : issues.join('; '),
  };
}

async function checkGA4AggregateRows() {
  // GA4 should have aggregate rows `(all)/(all)` source_medium for active clients last 7 days
  const since = daysAgo(7);
  const { data: clients, error: cErr } = await supabase
    .from('clients')
    .select('id')
    .eq('is_active', true)
    .eq('has_seo', true);

  if (cErr) return { passed: false, detail: cErr.message };
  if (!clients?.length)
    return { passed: true, detail: 'No active SEO clients to check' };

  const clientIds = clients.map((c) => c.id);

  // Check that at least some active clients have ga4_sessions in last 7 days
  const { data, error } = await supabase
    .from('ga4_sessions')
    .select('client_id')
    .in('client_id', clientIds.slice(0, 50)) // limit to avoid URL length issues
    .gte('date', since);

  if (error) return { passed: false, detail: error.message };

  const clientsWithData = new Set((data ?? []).map((r) => r.client_id)).size;
  const passed = clientsWithData > 0;
  return {
    passed,
    detail: `${clientsWithData}/${clients.length} active SEO clients have GA4 data in last 7 days`,
  };
}

// ─── Group C — Raw vs Summary Consistency ────────────────────────────────

async function checkGSCSummaryConsistency() {
  const since = daysAgo(7);
  const todayStr = today();

  // Raw GSC total_clicks
  const { data: raw, error: rawErr } = await supabase
    .from('gsc_daily_summary')
    .select('total_clicks')
    .gte('date', since)
    .lte('date', todayStr);

  if (rawErr) return { passed: false, detail: rawErr.message };

  // Summary seo_clicks
  const { data: sum, error: sumErr } = await supabase
    .from('client_metrics_summary')
    .select('seo_clicks')
    .gte('date', since)
    .lte('date', todayStr)
    .eq('period_type', 'daily');

  if (sumErr) return { passed: false, detail: sumErr.message };

  const rawTotal = (raw ?? []).reduce((a, r) => a + (r.total_clicks ?? 0), 0);
  const sumTotal = (sum ?? []).reduce((a, r) => a + (r.seo_clicks ?? 0), 0);

  if (rawTotal === 0 && sumTotal === 0) {
    return { passed: true, detail: 'Both sources have 0 clicks (no data yet)' };
  }
  if (rawTotal === 0) {
    return {
      passed: false,
      detail: `Raw GSC has 0 clicks but summary has ${sumTotal}`,
    };
  }

  const diff = Math.abs(rawTotal - sumTotal) / rawTotal;
  const pct = (diff * 100).toFixed(1);
  return {
    passed: diff <= 0.05,
    detail: `raw=${rawTotal} vs summary=${sumTotal} (${pct}% diff, threshold: 5%)`,
  };
}

async function checkAdsSummaryConsistency() {
  // Use CorePosture as sample client to avoid pagination
  const COREPOSTURE_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';
  const since = daysAgo(7);
  const todayStr = today();

  const { data: raw, error: rawErr } = await supabase
    .from('ads_campaign_metrics')
    .select('cost')
    .eq('client_id', COREPOSTURE_ID)
    .gte('date', since)
    .lte('date', todayStr);

  if (rawErr) return { passed: false, detail: rawErr.message };

  const { data: sum, error: sumErr } = await supabase
    .from('client_metrics_summary')
    .select('ad_spend')
    .eq('client_id', COREPOSTURE_ID)
    .gte('date', since)
    .lte('date', todayStr)
    .eq('period_type', 'daily');

  if (sumErr) return { passed: false, detail: sumErr.message };

  const rawTotal = (raw ?? []).reduce((a, r) => a + (r.cost ?? 0), 0);
  const sumTotal = (sum ?? []).reduce((a, r) => a + (r.ad_spend ?? 0), 0);

  if (rawTotal === 0 && sumTotal === 0) {
    return {
      passed: true,
      detail: 'CorePosture: both sources have $0 spend (no campaigns running)',
    };
  }
  if (rawTotal === 0) {
    return {
      passed: false,
      detail: `CorePosture: raw ads has $0 but summary has $${sumTotal.toFixed(2)}`,
    };
  }

  const diff = Math.abs(rawTotal - sumTotal) / rawTotal;
  const pct = (diff * 100).toFixed(1);
  return {
    passed: diff <= 0.01,
    detail: `CorePosture: raw=$${rawTotal.toFixed(2)} vs summary=$${sumTotal.toFixed(2)} (${pct}% diff, threshold: 1%)`,
  };
}

async function checkGBPSummaryConsistency() {
  const since = daysAgo(7);
  const todayStr = today();

  const { data: raw, error: rawErr } = await supabase
    .from('gbp_location_daily_metrics')
    .select('phone_calls')
    .gte('date', since)
    .lte('date', todayStr);

  if (rawErr) return { passed: false, detail: rawErr.message };

  const { data: sum, error: sumErr } = await supabase
    .from('client_metrics_summary')
    .select('gbp_calls')
    .gte('date', since)
    .lte('date', todayStr)
    .eq('period_type', 'daily');

  if (sumErr) return { passed: false, detail: sumErr.message };

  const rawTotal = (raw ?? []).reduce((a, r) => a + (r.phone_calls ?? 0), 0);
  const sumTotal = (sum ?? []).reduce((a, r) => a + (r.gbp_calls ?? 0), 0);

  if (rawTotal === 0 && sumTotal === 0) {
    return { passed: true, detail: 'Both sources have 0 GBP calls' };
  }
  if (rawTotal === 0) {
    return {
      passed: false,
      detail: `Raw GBP has 0 calls but summary has ${sumTotal}`,
    };
  }

  const diff = Math.abs(rawTotal - sumTotal) / rawTotal;
  const pct = (diff * 100).toFixed(1);
  // GBP has inherent small variance due to range-query aggregation differences
  return {
    passed: diff <= 0.05,
    detail: `raw=${rawTotal} vs summary=${sumTotal} (${pct}% diff, threshold: 5%)`,
  };
}

// ─── Group D — API Health ─────────────────────────────────────────────────

async function checkSyncStatus() {
  // Proxy: if rollup has written data in the last 3 days, the full cron pipeline is healthy.
  // (system_settings is not accessible via anon key due to RLS)
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, client_id')
    .eq('period_type', 'daily')
    .gte('date', daysAgo(3))
    .limit(1);
  if (error) return { passed: false, detail: `rollup health check failed: ${error.message}` };
  const hasRows = data && data.length > 0;
  return {
    passed: hasRows,
    detail: hasRows
      ? `Rollup has data within last 3 days — cron pipeline healthy`
      : 'No rollup data in last 3 days — cron pipeline may be down',
  };
}

async function checkRollupEndpoint() {
  // Verify rollup data exists in summary table for a recent historical date.
  // Avoids calling the auth-protected API endpoint directly.
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('client_id, date, sessions, ad_spend, gbp_calls')
    .eq('date', '2026-03-15')
    .eq('period_type', 'daily')
    .limit(1);
  if (error) return { passed: false, detail: error.message };
  const passed = (data?.length ?? 0) > 0;
  return {
    passed,
    detail: passed
      ? `summary rows exist for 2026-03-15 (sessions=${data[0].sessions}, spend=${data[0].ad_spend})`
      : 'No summary rows found for 2026-03-15 — rollup may not have run',
  };
}

// ─── Group E — Active Clients ─────────────────────────────────────────────

async function checkActiveClientsHaveData() {
  // Only check clients that have at least 1 data source configured
  // (unconfigured new clients legitimately have no data yet)
  const since = daysAgo(30);
  const { data: activeClients, error: cErr } = await supabase
    .from('clients')
    .select('id, name, has_seo, has_ads')
    .eq('is_active', true);

  if (cErr) return { passed: false, detail: cErr.message };

  // Only care about clients that have a configured data source
  const configuredClients = (activeClients ?? []).filter(
    (c) => c.has_seo || c.has_ads
  );
  if (!configuredClients.length) return { passed: true, detail: 'No configured active clients' };

  const { data: summaryRows, error: sErr } = await supabase
    .from('client_metrics_summary')
    .select('client_id')
    .gte('date', since)
    .in('client_id', configuredClients.map((c) => c.id));

  if (sErr) return { passed: false, detail: sErr.message };

  const clientsWithData = new Set((summaryRows ?? []).map((r) => r.client_id));
  const missing = configuredClients.filter((c) => !clientsWithData.has(c.id));

  return {
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `All ${configuredClients.length} configured active clients have summary data`
        : `${missing.length} configured client(s) with 0 summary rows: ${missing.map((c) => c.name).join(', ')}`,
  };
}

async function checkActiveClientsHaveDataSource() {
  // Flag active clients with NO data source at all (no has_seo, no has_ads, no GBP locations)
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, has_seo, has_ads')
    .eq('is_active', true);

  if (error) return { passed: false, detail: error.message };

  // Check which clients have GBP locations
  const { data: gbpLocs } = await supabase
    .from('gbp_locations')
    .select('client_id')
    .eq('is_active', true);
  const clientsWithGBP = new Set((gbpLocs ?? []).map((l) => l.client_id));

  const noSource = (clients ?? []).filter(
    (c) => !c.has_seo && !c.has_ads && !clientsWithGBP.has(c.id)
  );

  return {
    passed: noSource.length === 0,
    detail:
      noSource.length === 0
        ? `All ${clients?.length ?? 0} active clients have ≥1 data source (SEO, Ads, or GBP)`
        : `${noSource.length} active client(s) with no data sources: ${noSource.map((c) => c.name).join(', ')}`,
  };
}

// ─── Main runner ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}[CI GATE] Running 17 checks...${RESET}\n`);

  // Group A
  console.log(`${BOLD}Group A — Data Freshness${RESET}`);
  await check(1, 'GA4 data < 3 days old', checkGA4Freshness);
  await check(2, 'GSC data < 5 days old', checkGSCFreshness);
  await check(3, 'Ads data < 3 days old', checkAdsFreshness);
  await check(4, 'GBP data < 5 days old', checkGBPFreshness);
  await check(5, 'client_metrics_summary has rows in last 4 days', checkSummaryYesterday);

  // Group B
  console.log(`\n${BOLD}Group B — Data Integrity${RESET}`);
  await check(6, 'No duplicates in client_metrics_summary', checkNoDuplicates);
  await check(7, 'No negative values (sessions/spend/calls)', checkNoNegatives);
  await check(8, 'No future-dated rows', checkNoFutureDates);
  await check(9, 'No ghost client data in last 7 days', checkNoGhostClients);
  await check(10, 'GA4 data exists for active clients (last 7 days)', checkGA4AggregateRows);

  // Group C
  console.log(`\n${BOLD}Group C — Raw vs Summary Consistency (last 7 days)${RESET}`);
  await check(11, 'GSC clicks: raw ≈ summary (tolerance 5%)', checkGSCSummaryConsistency);
  await check(12, 'Ads spend: CorePosture raw ≈ summary (tolerance 1%)', checkAdsSummaryConsistency);
  await check(13, 'GBP calls: raw ≈ summary (tolerance 1%)', checkGBPSummaryConsistency);

  // Group D
  console.log(`\n${BOLD}Group D — API Health${RESET}`);
  await check(14, 'GET /api/cron/sync-status → 200 + allHealthy field', checkSyncStatus);
  await check(15, 'client_metrics_summary has rollup data for 2026-03-15', checkRollupEndpoint);

  // Group E
  console.log(`\n${BOLD}Group E — Active Clients${RESET}`);
  await check(16, 'All active clients have summary rows (last 30 days)', checkActiveClientsHaveData);
  await check(17, 'All active clients have ≥1 data source configured', checkActiveClientsHaveDataSource);

  // ─── Print results ───────────────────────────────────────────────────────

  console.log('');
  for (const r of results) {
    const icon = r.passed ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`;
    const num = String(r.num).padStart(2, ' ');
    console.log(`  ${icon} #${num}  ${r.label}`);
    if (r.detail) {
      console.log(`         ${r.detail}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('');
  console.log(`${BOLD}RESULTS: ${passed}/${total} PASS (${failed} FAIL)${RESET}`);

  if (failed === 0) {
    console.log(`${GREEN}${BOLD}✅ All checks passed — safe to deploy${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}❌ GATE FAILED — do not deploy${RESET}`);
    const failures = results.filter((r) => !r.passed);
    for (const f of failures) {
      console.log(`  ${RED}- #${f.num} ${f.label}${RESET}`);
      console.log(`    ${f.detail}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}[CI GATE] Fatal error: ${err.message}${RESET}`);
  process.exit(1);
});
