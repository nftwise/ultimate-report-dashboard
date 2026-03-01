/**
 * Backfill Remaining Ads Gaps (retry after quota reset)
 *
 * Run this after Google Ads API daily quota resets (midnight PT).
 * It will find and fill any remaining ads_campaign_metrics gaps.
 *
 * Usage: node scripts/backfill-ads-remaining.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

const BASE_URL = 'https://ultimate-report-dashboard.vercel.app';
const DELAY_MS = 5000; // 5s between calls (more conservative)

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

async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   RETRY REMAINING ADS GAPS               ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  // Find all ads clients with gaps
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

  const allGapDates = new Set();
  for (const client of adsClients) {
    const dates = await getDataDates('ads_campaign_metrics', client.id);
    if (dates.length === 0) continue;
    const gaps = findGaps(dates);
    if (gaps.length > 0) {
      gaps.forEach(d => allGapDates.add(d));
      console.log(`  ${client.name}: ${gaps.length} gaps remaining`);
    } else {
      console.log(`  ${client.name}: ✅ CLEAN`);
    }
  }

  const uniqueDates = [...allGapDates].sort();
  console.log(`\n  Unique dates to retry: ${uniqueDates.length}\n`);

  if (uniqueDates.length === 0) {
    console.log('🎉 No gaps remaining!');
    return;
  }

  // First test: can we get data?
  console.log('  Testing API access...');
  const testResult = await callSyncAds(uniqueDates[0]);
  if (testResult.ok && testResult.campaigns > 0) {
    console.log(`  ✅ API working: ${testResult.campaigns} campaigns for ${uniqueDates[0]}\n`);
  } else if (testResult.ok && testResult.campaigns === 0) {
    console.log(`  ⚠️  API returned 0 campaigns for ${uniqueDates[0]}`);
    console.log(`  This may mean the API quota hasn't reset yet, or this date genuinely has no data.`);
    console.log(`  Continuing anyway...\n`);
  } else {
    console.log(`  ❌ API error: ${testResult.error}`);
    console.log(`  API quota may not have reset. Try again later.\n`);
    return;
  }

  // Sync all gap dates
  console.log(`━━━ Syncing ${uniqueDates.length} dates ━━━\n`);
  let success = 0, fail = 0, withData = 0;

  for (let i = 0; i < uniqueDates.length; i++) {
    const date = uniqueDates[i];
    const result = await callSyncAds(date);
    if (result.ok) {
      success++;
      if (result.campaigns > 0) withData++;
      if ((i + 1) % 5 === 0 || i === uniqueDates.length - 1) {
        console.log(`  [${i + 1}/${uniqueDates.length}] ${date}: ✅ ${result.campaigns} campaigns`);
      }
    } else {
      fail++;
      console.log(`  [${i + 1}/${uniqueDates.length}] ${date}: ❌ ${result.error}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n  Sync: ${success} success (${withData} with data), ${fail} failed`);

  // Rollup
  console.log(`\n━━━ Running rollup for ${uniqueDates.length} dates ━━━\n`);
  let rollupOk = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const ok = await callRollup(uniqueDates[i]);
    if (ok) rollupOk++;
    if ((i + 1) % 10 === 0 || i === uniqueDates.length - 1) {
      console.log(`  [${i + 1}/${uniqueDates.length}] Rollup: ${rollupOk} success`);
    }
    await sleep(1000);
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║      RETRY COMPLETE                      ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`\nRun 'node scripts/data_audit.mjs' to verify.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
