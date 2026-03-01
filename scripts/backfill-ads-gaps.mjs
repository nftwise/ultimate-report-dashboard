/**
 * Backfill Ads Campaign Metrics Gaps
 *
 * Finds all missing ads dates across 7 clients, collects unique dates,
 * and calls sync-ads for each date via Vercel production URL.
 * Then runs rollup for each date.
 *
 * Usage: node scripts/backfill-ads-gaps.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

const BASE_URL = 'https://ultimate-report-dashboard.vercel.app';
const DELAY_MS = 3000; // 3s between sync calls to avoid rate limiting
const ROLLUP_DELAY_MS = 1000;

// The 7 clients with ads gaps
const ADS_CLIENT_IDS = [
  '939903b3-bbcf-4768-938f-1b17395eec95', // Cinque Chiropractic
  '5a43ff66-3a5b-4fd7-a744-452d5a82594c', // CorePosture (need to verify)
  'bd77bf95-9255-4fbe-ba75-4340cb010c72', // DeCarlo Chiropractic (need to verify)
  '900a419a-2f88-4bae-8fd7-5d5dea4ddc7e', // Healing Hands
  '899d2381-397a-44fd-a5ed-99c2369eef2a', // Hood Chiropractic
  'e7deca15-e89a-4a11-97ec-75a9a9119eb4', // Ray Chiropractic
  'dae54e8a-0c3e-4e0d-a0d5-bc0e42c3e8b1', // Zen Care (need to verify)
];

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

function findGaps(dates) {
  if (dates.length === 0) return [];
  const oldest = dates[0];
  const newest = dates[dates.length - 1];
  const allDays = [];
  const start = new Date(oldest + 'T12:00:00Z');
  const end = new Date(newest + 'T12:00:00Z');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDays.push(d.toISOString().split('T')[0]);
  }
  const dateSet = new Set(dates);
  return allDays.filter(d => !dateSet.has(d));
}

async function callSyncAds(date) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const res = await fetch(`${BASE_URL}/api/cron/sync-ads?date=${date}`, { signal: controller.signal });
    clearTimeout(timeout);
    const json = await res.json();
    if (res.ok && json.success !== false) {
      return { ok: true, campaigns: json.records?.campaigns || 0, total: json.total || 0, errors: json.errors };
    }
    return { ok: false, error: json.error || 'unknown error' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function callRollup(date) {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/run-rollup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ MAIN ============
async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   BACKFILL ADS CAMPAIGN METRICS GAPS     ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  // Step 1: Find all clients with ads config + their IDs
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, has_ads, service_configs(gads_customer_id)')
    .eq('is_active', true)
    .eq('has_ads', true)
    .order('name');

  const adsClients = (clients || [])
    .map(c => ({
      id: c.id,
      name: c.name,
      customerId: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gads_customer_id,
    }))
    .filter(c => c.customerId);

  console.log(`Found ${adsClients.length} clients with Google Ads config:\n`);
  adsClients.forEach(c => console.log(`  ${c.name} (${c.id}) → ${c.customerId}`));

  // Step 2: Find gaps for each client
  console.log(`\n━━━ Finding gaps per client ━━━\n`);
  const allGapDates = new Set();
  const clientGaps = {};

  for (const client of adsClients) {
    const dates = await getDataDates('ads_campaign_metrics', client.id);
    if (dates.length === 0) {
      console.log(`  ${client.name}: NO DATA (skipping - may not have active campaigns)`);
      continue;
    }
    const gaps = findGaps(dates);
    if (gaps.length > 0) {
      clientGaps[client.name] = gaps.length;
      gaps.forEach(d => allGapDates.add(d));
      console.log(`  ${client.name}: ${dates.length} dates, ${gaps.length} gaps (${gaps[0]} → ${gaps[gaps.length - 1]})`);
    } else {
      console.log(`  ${client.name}: ✅ CLEAN (${dates.length} dates)`);
    }
  }

  const uniqueDates = [...allGapDates].sort();
  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Unique dates to backfill: ${uniqueDates.length}`);
  console.log(`  Date range: ${uniqueDates[0]} → ${uniqueDates[uniqueDates.length - 1]}`);
  console.log(`  Estimated time: ~${Math.ceil(uniqueDates.length * DELAY_MS / 60000)} minutes for sync + ~${Math.ceil(uniqueDates.length * ROLLUP_DELAY_MS / 60000)} minutes for rollup\n`);

  if (uniqueDates.length === 0) {
    console.log('🎉 No gaps to fill!');
    return;
  }

  // Step 3: Sync all gap dates
  console.log(`━━━ PHASE 1: Syncing ${uniqueDates.length} dates via sync-ads ━━━\n`);
  let success = 0, fail = 0;
  const failedDates = [];

  for (let i = 0; i < uniqueDates.length; i++) {
    const date = uniqueDates[i];
    const result = await callSyncAds(date);
    if (result.ok) {
      success++;
      // Show progress every 10 dates
      if ((i + 1) % 10 === 0 || i === uniqueDates.length - 1) {
        console.log(`  [${i + 1}/${uniqueDates.length}] ${date}: ✅ ${result.campaigns} campaigns, ${result.total} total${result.errors ? ' (with errors: ' + result.errors.join(', ') + ')' : ''}`);
      }
    } else {
      fail++;
      failedDates.push(date);
      console.log(`  [${i + 1}/${uniqueDates.length}] ${date}: ❌ ${result.error}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n  Sync complete: ${success} success, ${fail} failed`);
  if (failedDates.length > 0) {
    console.log(`  Failed dates: ${failedDates.join(', ')}`);
  }

  // Step 4: Run rollup for all dates
  console.log(`\n━━━ PHASE 2: Running rollup for ${uniqueDates.length} dates ━━━\n`);
  let rollupOk = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const ok = await callRollup(uniqueDates[i]);
    if (ok) rollupOk++;
    if ((i + 1) % 20 === 0 || i === uniqueDates.length - 1) {
      console.log(`  [${i + 1}/${uniqueDates.length}] Rollup progress: ${rollupOk} success`);
    }
    await sleep(ROLLUP_DELAY_MS);
  }
  console.log(`  Rollup done: ${rollupOk}/${uniqueDates.length} success`);

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║      ADS BACKFILL COMPLETE               ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`\nRun 'node scripts/data_audit.mjs' to verify.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
