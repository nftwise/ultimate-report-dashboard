/**
 * Historical Backfill Script
 *
 * Backfills GA4, GSC, Ads, GBP data for all clients across the full history.
 * Uses the production sync endpoints with CRON_SECRET auth.
 *
 * Priority:
 *   1. Last 90 days (most important for dashboards)
 *   2. Older history (2025-01-01 onward)
 *
 * After sync, triggers rollup for all backfilled dates.
 *
 * Usage:
 *   CRON_SECRET=xxx node scripts/backfill-historical.mjs
 *   CRON_SECRET=xxx node scripts/backfill-historical.mjs --ga4-only
 *   CRON_SECRET=xxx node scripts/backfill-historical.mjs --start=2026-01-01
 *   CRON_SECRET=xxx node scripts/backfill-historical.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';

// ============ CONFIG ============

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const BASE_URL = 'https://ultimate-report-dashboard.vercel.app';

// Delay between sync calls to avoid Vercel rate limits (5s)
const DELAY_MS = 5000;
// Delay between rollup calls (shorter, rollup is fast)
const ROLLUP_DELAY_MS = 2000;

const CRON_SECRET = process.env.CRON_SECRET || '';
const DRY_RUN = process.argv.includes('--dry-run');
const GA4_ONLY = process.argv.includes('--ga4-only');
const GSC_ONLY = process.argv.includes('--gsc-only');
const ADS_ONLY = process.argv.includes('--ads-only');
const GBP_ONLY = process.argv.includes('--gbp-only');

// Parse --start=YYYY-MM-DD
const startArg = process.argv.find(a => a.startsWith('--start='));
const RANGE_START = startArg ? startArg.split('=')[1] : '2025-01-01';

// Yesterday in California time (same logic as cron endpoints)
function getYesterday() {
  const now = new Date();
  const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  caToday.setDate(caToday.getDate() - 1);
  return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
}

const RANGE_END = getYesterday();

// ============ SUPABASE CLIENT ============

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ HELPERS ============

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getAllDaysBetween(start, end) {
  const days = [];
  const s = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** Returns dates in [rangeStart, rangeEnd] that are NOT in existingDates */
function findMissingDates(existingDates, rangeStart, rangeEnd) {
  const dateSet = new Set(existingDates);
  return getAllDaysBetween(rangeStart, rangeEnd).filter(d => !dateSet.has(d));
}

/** Paginated fetch of distinct dates from a table for a given client */
async function getExistingDates(table, clientId) {
  let allDates = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('date')
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allDates = allDates.concat(data.map(r => r.date));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return [...new Set(allDates)].sort();
}

/** Call a sync or rollup endpoint with CRON_SECRET auth */
async function callEndpoint(path, label) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would call: ${BASE_URL}${path}`);
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 290000);

    const headers = { 'Content-Type': 'application/json' };
    if (CRON_SECRET) headers['Authorization'] = `Bearer ${CRON_SECRET}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json().catch(() => ({}));

    if (res.ok && json.success !== false) {
      const detail = json.total != null ? ` (${json.total} records)` : (json.synced != null ? ` (${json.synced} synced)` : '');
      const errDetail = json.errors?.length ? ` | errors: ${json.errors.slice(0, 2).join('; ')}` : '';
      console.log(`  OK  ${label}${detail}${errDetail}`);
      return true;
    } else {
      console.log(`  WARN ${label}: ${json.error || JSON.stringify(json).slice(0, 120)}`);
      return false;
    }
  } catch (err) {
    console.log(`  FAIL ${label}: ${err.message}`);
    return false;
  }
}

/** Prioritize last 90 days, then older */
function sortByPriority(dates) {
  const cutoff = getAllDaysBetween(RANGE_END, RANGE_END)[0];
  const d90 = new Date(cutoff + 'T12:00:00Z');
  d90.setDate(d90.getDate() - 90);
  const cutoff90 = d90.toISOString().split('T')[0];

  const recent = dates.filter(d => d >= cutoff90).sort().reverse(); // newest first in recent
  const older = dates.filter(d => d < cutoff90).sort().reverse();   // newest first in older
  return [...recent, ...older];
}

// ============ GAP DETECTION ============

async function detectGaps(clients, gbpClientIds) {
  console.log(`\nScanning ${clients.length} clients for data gaps (${RANGE_START} to ${RANGE_END})...\n`);

  const ga4Gaps = new Set();
  const gscGaps = new Set();
  const adsGaps = new Set();
  const gbpGaps = new Set();

  for (const client of clients) {
    const hasGBP = gbpClientIds.has(client.id);

    if (client.has_seo) {
      const existing = await getExistingDates('ga4_sessions', client.id);
      const missing = findMissingDates(existing, RANGE_START, RANGE_END);
      missing.forEach(d => ga4Gaps.add(d));

      const existingGSC = await getExistingDates('gsc_queries', client.id);
      // GSC has 2-3 day lag, so end 3 days before yesterday
      const gscEnd = new Date(RANGE_END + 'T12:00:00Z');
      gscEnd.setDate(gscEnd.getDate() - 3);
      const gscRangeEnd = gscEnd.toISOString().split('T')[0];
      const missingGSC = findMissingDates(existingGSC, RANGE_START, gscRangeEnd);
      missingGSC.forEach(d => gscGaps.add(d));

      if (missing.length > 0 || missingGSC.length > 0) {
        console.log(`  ${client.name}: ${missing.length} GA4 gaps, ${missingGSC.length} GSC gaps`);
      }
    }

    if (client.has_ads) {
      const existing = await getExistingDates('ads_campaign_metrics', client.id);
      const missing = findMissingDates(existing, RANGE_START, RANGE_END);
      missing.forEach(d => adsGaps.add(d));
      if (missing.length > 0) console.log(`  ${client.name}: ${missing.length} Ads gaps`);
    }

    if (hasGBP) {
      const existing = await getExistingDates('gbp_location_daily_metrics', client.id);
      const missing = findMissingDates(existing, RANGE_START, RANGE_END);
      missing.forEach(d => gbpGaps.add(d));
      if (missing.length > 0) console.log(`  ${client.name}: ${missing.length} GBP gaps`);
    }
  }

  return {
    ga4: sortByPriority([...ga4Gaps]),
    gsc: sortByPriority([...gscGaps]),
    ads: sortByPriority([...adsGaps]),
    gbp: sortByPriority([...gbpGaps]),
  };
}

// ============ BACKFILL PHASES ============

async function backfillPhase(name, endpoint, dates) {
  if (dates.length === 0) {
    console.log(`\n[${name}] No gaps found, skipping.`);
    return { success: 0, fail: 0 };
  }

  console.log(`\n=== PHASE: Backfilling ${name} (${dates.length} dates) ===`);
  console.log(`  First: ${dates[0]}  Last: ${dates[dates.length - 1]}`);

  let success = 0, fail = 0;
  for (const date of dates) {
    const ok = await callEndpoint(`${endpoint}?date=${date}`, `${name} ${date}`);
    ok ? success++ : fail++;
    await sleep(DELAY_MS);
  }
  console.log(`  ${name} done: ${success} OK, ${fail} failed`);
  return { success, fail };
}

async function runRollup(dates) {
  if (dates.length === 0) return;

  // Deduplicate + sort ascending (rollup naturally processes oldest first)
  const unique = [...new Set(dates)].sort();
  console.log(`\n=== PHASE: Running Rollup (${unique.length} unique dates) ===`);

  let success = 0, fail = 0;
  for (const date of unique) {
    const ok = await callEndpoint(`/api/admin/run-rollup?date=${date}`, `Rollup ${date}`);
    ok ? success++ : fail++;
    await sleep(ROLLUP_DELAY_MS);
  }
  console.log(`  Rollup done: ${success} OK, ${fail} failed`);
}

async function runFixLag() {
  console.log(`\n=== PHASE: Fix Summary Lag ===`);
  await callEndpoint('/api/cron/fix-summary-lag', 'fix-summary-lag');
}

// ============ MAIN ============

async function main() {
  console.log(`\n${'='.repeat(55)}`);
  console.log(`  HISTORICAL BACKFILL`);
  console.log(`  Range: ${RANGE_START} to ${RANGE_END}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Auth: ${CRON_SECRET ? 'CRON_SECRET set' : 'NO AUTH (may fail on prod)'}`);
  if (DRY_RUN) console.log(`  Mode: DRY RUN`);
  console.log(`${'='.repeat(55)}\n`);

  // 1. Verify server
  try {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    console.log(`Server reachable: ${BASE_URL} (status: ${res.status})`);
  } catch (e) {
    console.error(`Server not reachable at ${BASE_URL}: ${e.message}`);
    process.exit(1);
  }

  // 2. Get clients
  const [{ data: clients, error: clientsErr }, { data: gbpLocs }] = await Promise.all([
    supabase.from('clients').select('id, name, slug, has_seo, has_ads').eq('is_active', true).order('name'),
    supabase.from('gbp_locations').select('client_id').eq('is_active', true),
  ]);

  if (clientsErr) {
    console.error(`Failed to fetch clients: ${clientsErr.message}`);
    process.exit(1);
  }

  const gbpClientIds = new Set((gbpLocs || []).map(l => l.client_id));
  console.log(`Found ${clients.length} active clients, ${gbpClientIds.size} with GBP`);

  // 3. Detect gaps
  const gaps = await detectGaps(clients, gbpClientIds);
  const allGapDates = new Set([...gaps.ga4, ...gaps.gsc, ...gaps.ads, ...gaps.gbp]);

  console.log(`\n--- GAP SUMMARY ---`);
  console.log(`GA4:  ${gaps.ga4.length} missing dates`);
  console.log(`GSC:  ${gaps.gsc.length} missing dates`);
  console.log(`Ads:  ${gaps.ads.length} missing dates`);
  console.log(`GBP:  ${gaps.gbp.length} missing dates`);
  console.log(`Total unique dates needing rollup: ${allGapDates.size}`);

  if (allGapDates.size === 0) {
    console.log('\nNo gaps found! All data is complete.');
    return;
  }

  // Determine which phases to run
  const runAll = !GA4_ONLY && !GSC_ONLY && !ADS_ONLY && !GBP_ONLY;
  const results = {};

  // 4. Backfill GA4 (highest priority)
  if (runAll || GA4_ONLY) {
    results.ga4 = await backfillPhase('GA4', '/api/cron/sync-ga4', gaps.ga4);
  }

  // 5. Backfill GSC
  if (runAll || GSC_ONLY) {
    results.gsc = await backfillPhase('GSC', '/api/cron/sync-gsc', gaps.gsc);
  }

  // 6. Backfill Ads
  if (runAll || ADS_ONLY) {
    results.ads = await backfillPhase('Ads', '/api/cron/sync-ads', gaps.ads);
  }

  // 7. Backfill GBP
  if (runAll || GBP_ONLY) {
    results.gbp = await backfillPhase('GBP', '/api/cron/sync-gbp', gaps.gbp);
  }

  // 8. Run rollup for all touched dates
  if (!DRY_RUN && runAll) {
    await runRollup([...allGapDates]);
    await sleep(3000);
    await runFixLag();
  } else if (!DRY_RUN) {
    // Only run rollup for the phases that were actually backfilled
    const rolledDates = new Set();
    if (GA4_ONLY) gaps.ga4.forEach(d => rolledDates.add(d));
    if (GSC_ONLY) gaps.gsc.forEach(d => rolledDates.add(d));
    if (ADS_ONLY) gaps.ads.forEach(d => rolledDates.add(d));
    if (GBP_ONLY) gaps.gbp.forEach(d => rolledDates.add(d));
    await runRollup([...rolledDates]);
  }

  // 9. Summary
  console.log(`\n${'='.repeat(55)}`);
  console.log(`  BACKFILL COMPLETE`);
  console.log(`${'='.repeat(55)}`);
  if (results.ga4) console.log(`GA4:  ${results.ga4.success} OK, ${results.ga4.fail} failed`);
  if (results.gsc) console.log(`GSC:  ${results.gsc.success} OK, ${results.gsc.fail} failed`);
  if (results.ads) console.log(`Ads:  ${results.ads.success} OK, ${results.ads.fail} failed`);
  if (results.gbp) console.log(`GBP:  ${results.gbp.success} OK, ${results.gbp.fail} failed`);
  console.log(`\nRun 'node scripts/data_audit.mjs' to verify completeness.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
