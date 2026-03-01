/**
 * Master Backfill Script
 *
 * Finds all missing dates in raw tables (ga4_sessions, ads_campaign_metrics,
 * gbp_location_daily_metrics) and backfills them by calling the cron sync
 * endpoints with specific dates, then re-runs rollup.
 *
 * Uses Vercel production URL (has real OAuth credentials for GBP)
 * Usage: node scripts/backfill-all-gaps.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

const BASE_URL = 'https://ultimate-report-dashboard.vercel.app';
const DELAY_MS = 5000; // 5 seconds between API calls to avoid rate limits on Vercel

// ============ HELPERS ============

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getDataDates(table, clientId) {
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

function getAllDaysBetween(start, end) {
  const days = [];
  // Use noon UTC to avoid timezone boundary issues
  const s = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function findGaps(dates, rangeStart, rangeEnd) {
  if (dates.length === 0) return getAllDaysBetween(rangeStart, rangeEnd);
  const oldest = dates[0] < rangeStart ? rangeStart : dates[0];
  const newest = dates[dates.length - 1] > rangeEnd ? rangeEnd : dates[dates.length - 1];
  const allDays = getAllDaysBetween(oldest, newest);
  const dateSet = new Set(dates);
  return allDays.filter(d => !dateSet.has(d));
}

async function callEndpoint(path, label) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 290000); // 290s timeout
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    clearTimeout(timeout);
    const json = await res.json();
    if (res.ok && json.success !== false) {
      console.log(`  ✅ ${label}: OK`);
      return true;
    } else {
      console.log(`  ⚠️  ${label}: ${json.error || JSON.stringify(json).slice(0, 100)}`);
      return false;
    }
  } catch (err) {
    console.log(`  ❌ ${label}: ${err.message}`);
    return false;
  }
}

// ============ MAIN ============

async function main() {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║     MASTER BACKFILL - REAL API DATA  ║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // Step 0: Verify server is reachable
  try {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    console.log(`✅ Server reachable at ${BASE_URL} (status: ${res.status})\n`);
  } catch (e) {
    console.error(`❌ Server not reachable at ${BASE_URL}: ${e.message}`);
    process.exit(1);
  }

  // Step 1: Get all active clients + their services
  const [{ data: clients }, { data: gbpLocs }] = await Promise.all([
    supabase.from('clients').select('id, name, slug, has_seo, has_ads').eq('is_active', true).order('name'),
    supabase.from('gbp_locations').select('client_id').eq('is_active', true)
  ]);
  const gbpClientIds = new Set(gbpLocs.map(l => l.client_id));
  clients.forEach(c => { c.has_gbp = gbpClientIds.has(c.id); });

  // Step 2: Find ALL missing dates per raw table
  console.log(`📊 Scanning ${clients.length} clients for data gaps...\n`);

  const ga4GapDates = new Set();
  const adsGapDates = new Set();
  const gbpGapDates = new Set();
  const allGapDates = new Set();

  // Data range: 2025-01-01 to 2026-02-27 (latest data)
  const RANGE_START = '2025-01-01';
  const RANGE_END = '2026-02-27';

  for (const client of clients) {
    // GA4 gaps
    if (client.has_seo) {
      const dates = await getDataDates('ga4_sessions', client.id);
      const gaps = findGaps(dates, RANGE_START, RANGE_END);
      gaps.forEach(d => { ga4GapDates.add(d); allGapDates.add(d); });
      if (gaps.length > 0) console.log(`  ${client.name}: ${gaps.length} GA4 gaps`);
    }

    // Ads gaps (skip ads-only clients per user instruction)
    if (client.has_ads && (client.has_seo || client.has_gbp)) {
      const dates = await getDataDates('ads_campaign_metrics', client.id);
      const gaps = findGaps(dates, RANGE_START, RANGE_END);
      gaps.forEach(d => { adsGapDates.add(d); allGapDates.add(d); });
      if (gaps.length > 0) console.log(`  ${client.name}: ${gaps.length} Ads gaps`);
    }

    // GBP gaps
    if (client.has_gbp) {
      const dates = await getDataDates('gbp_location_daily_metrics', client.id);
      const gaps = findGaps(dates, RANGE_START, RANGE_END);
      gaps.forEach(d => { gbpGapDates.add(d); allGapDates.add(d); });
      if (gaps.length > 0) console.log(`  ${client.name}: ${gaps.length} GBP gaps`);
    }
  }

  // Also check client_metrics_summary gaps
  const summaryGapDates = new Set();
  for (const client of clients) {
    const dates = await getDataDates('client_metrics_summary', client.id);
    const gaps = findGaps(dates, RANGE_START, RANGE_END);
    gaps.forEach(d => { summaryGapDates.add(d); allGapDates.add(d); });
  }

  const sortedGA4 = [...ga4GapDates].sort();
  const sortedAds = [...adsGapDates].sort();
  const sortedGBP = [...gbpGapDates].sort();
  const sortedAll = [...allGapDates].sort();

  console.log(`\n━━━ GAP SUMMARY ━━━`);
  console.log(`GA4 unique gap dates: ${sortedGA4.length}`);
  console.log(`Ads unique gap dates: ${sortedAds.length}`);
  console.log(`GBP unique gap dates: ${sortedGBP.length}`);
  console.log(`Summary unique gap dates: ${summaryGapDates.size}`);
  console.log(`Total unique dates to process: ${sortedAll.length}\n`);

  if (sortedAll.length === 0) {
    console.log('🎉 No gaps found! All data is complete.');
    return;
  }

  // Step 3: Backfill GA4 raw data
  if (sortedGA4.length > 0) {
    console.log(`\n━━━ PHASE 1: Backfilling GA4 (${sortedGA4.length} dates) ━━━`);
    let success = 0, fail = 0;
    for (const date of sortedGA4) {
      const ok = await callEndpoint(`/api/cron/sync-ga4?date=${date}`, `GA4 ${date}`);
      ok ? success++ : fail++;
      await sleep(DELAY_MS);
    }
    console.log(`GA4 done: ${success} success, ${fail} failed\n`);
  }

  // Step 4: Backfill Ads raw data
  if (sortedAds.length > 0) {
    console.log(`\n━━━ PHASE 2: Backfilling Ads (${sortedAds.length} dates) ━━━`);
    let success = 0, fail = 0;
    for (const date of sortedAds) {
      const ok = await callEndpoint(`/api/cron/sync-ads?date=${date}`, `Ads ${date}`);
      ok ? success++ : fail++;
      await sleep(DELAY_MS);
    }
    console.log(`Ads done: ${success} success, ${fail} failed\n`);
  }

  // Step 5: Backfill GBP raw data
  if (sortedGBP.length > 0) {
    console.log(`\n━━━ PHASE 3: Backfilling GBP (${sortedGBP.length} dates) ━━━`);
    let success = 0, fail = 0;
    for (const date of sortedGBP) {
      const ok = await callEndpoint(`/api/cron/sync-gbp?date=${date}`, `GBP ${date}`);
      ok ? success++ : fail++;
      await sleep(DELAY_MS);
    }
    console.log(`GBP done: ${success} success, ${fail} failed\n`);
  }

  // Step 6: Re-run rollup for ALL gap dates
  console.log(`\n━━━ PHASE 4: Running Rollup (${sortedAll.length} dates) ━━━`);
  let rollupSuccess = 0, rollupFail = 0;
  for (const date of sortedAll) {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/run-rollup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (res.ok) {
        console.log(`  ✅ Rollup ${date}: OK`);
        rollupSuccess++;
      } else {
        console.log(`  ⚠️  Rollup ${date}: ${json.error || 'failed'}`);
        rollupFail++;
      }
    } catch (err) {
      console.log(`  ❌ Rollup ${date}: ${err.message}`);
      rollupFail++;
    }
    await sleep(1000);
  }
  console.log(`Rollup done: ${rollupSuccess} success, ${rollupFail} failed\n`);

  // Summary
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║        BACKFILL COMPLETE             ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`GA4: ${sortedGA4.length} dates processed`);
  console.log(`Ads: ${sortedAds.length} dates processed`);
  console.log(`GBP: ${sortedGBP.length} dates processed`);
  console.log(`Rollup: ${rollupSuccess}/${sortedAll.length} success`);
  console.log(`\nRun 'node scripts/data_audit.mjs' to verify completeness.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
