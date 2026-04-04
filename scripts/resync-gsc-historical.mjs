/**
 * resync-gsc-historical.mjs
 *
 * Re-syncs GSC data for the full historical window: Apr 2025 → Feb 2026 (334 days).
 * Run this from local after the range-query and rollup fixes are deployed.
 *
 * Usage:
 *   node scripts/resync-gsc-historical.mjs
 *
 * Env vars needed:
 *   BASE_URL     - e.g. https://your-app.vercel.app (or http://localhost:3000)
 *   CRON_SECRET  - your CRON_SECRET value (same as in Vercel env)
 *
 * Progress is printed to stdout. On error, the script logs and continues.
 * Rate: 1 request every 3s to avoid hammering the GSC API.
 */

import { setTimeout as sleep } from 'timers/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

if (!CRON_SECRET) {
  console.warn('[WARNING] CRON_SECRET not set — requests may be rejected with 401');
}

// Build date range: Apr 1 2025 → Feb 28 2026
function buildDateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const START_DATE = '2025-04-01';
const END_DATE = '2026-02-28';

const dates = buildDateRange(START_DATE, END_DATE);
console.log(`[resync-gsc-historical] Syncing ${dates.length} dates from ${START_DATE} → ${END_DATE}`);
console.log(`[resync-gsc-historical] Base URL: ${BASE_URL}`);
console.log('[resync-gsc-historical] Starting in 3 seconds...\n');
await sleep(3000);

let succeeded = 0;
let failed = 0;
const failedDates = [];

for (let i = 0; i < dates.length; i++) {
  const date = dates[i];
  const pct = Math.round(((i + 1) / dates.length) * 100);

  try {
    const url = `${BASE_URL}/api/cron/sync-gsc?date=${date}`;
    const res = await fetch(url, {
      headers: CRON_SECRET ? { 'Authorization': `Bearer ${CRON_SECRET}` } : {},
      signal: AbortSignal.timeout(90000), // 90s timeout per request
    });

    if (res.ok) {
      const data = await res.json();
      const total = data.total ?? '?';
      console.log(`[${pct}%] ${date} ✓ — ${total} records synced (${i + 1}/${dates.length})`);
      succeeded++;
    } else {
      const text = await res.text().catch(() => '(no body)');
      console.error(`[${pct}%] ${date} ✗ — HTTP ${res.status}: ${text.slice(0, 200)}`);
      failed++;
      failedDates.push(date);
    }
  } catch (err) {
    console.error(`[${pct}%] ${date} ✗ — ${err.message}`);
    failed++;
    failedDates.push(date);
  }

  // 3-second delay between requests to avoid rate limits
  if (i < dates.length - 1) {
    await sleep(3000);
  }
}

console.log('\n═══════════════════════════════════════');
console.log(`[resync-gsc-historical] Complete!`);
console.log(`  Succeeded: ${succeeded}/${dates.length}`);
console.log(`  Failed:    ${failed}/${dates.length}`);
if (failedDates.length > 0) {
  console.log(`  Failed dates: ${failedDates.slice(0, 20).join(', ')}${failedDates.length > 20 ? ` ... and ${failedDates.length - 20} more` : ''}`);
}
console.log('═══════════════════════════════════════');
