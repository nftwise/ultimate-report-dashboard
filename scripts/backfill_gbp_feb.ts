import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE = 'https://ultimate-report-dashboard.vercel.app';
const dates = ['2026-02-22','2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27','2026-02-28'];

async function main() {
  console.log('\n=== Backfilling GBP data for Feb 22-28 ===\n');

  for (const date of dates) {
    console.log(`  Syncing GBP ${date}...`);
    const res = await fetch(`${BASE}/api/cron/sync-gbp?date=${date}`);
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.message || j.synced || (j.success !== undefined ? `success=${j.success} synced=${j.synced}` : JSON.stringify(j).slice(0, 150));
    } catch {}
    console.log(`    ${res.status}: ${msg.slice(0, 150)}`);
    // Small delay between requests to avoid hammering the GBP API
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== Re-running rollup for Feb 22-28 ===\n');

  for (const date of dates) {
    const res = await fetch(`${BASE}/api/admin/run-rollup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.success ? `processed=${j.processed}` : j.error || '';
    } catch {}
    console.log(`  rollup ${date}: ${res.status} ${msg.slice(0, 100)}`);
  }

  console.log('\nDone.');
}
main().catch(console.error);
