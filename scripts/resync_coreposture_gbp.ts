import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET || '';
const CLIENT_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac'; // CorePosture

async function run() {
  const dates: string[] = [];
  // Feb 1 - Mar 11 (39 days)
  const start = new Date('2026-02-01');
  const end = new Date('2026-03-11');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  console.log(`Syncing GBP for CorePosture: ${dates[0]} → ${dates[dates.length-1]} (${dates.length} dates)`);

  let ok = 0, fail = 0;
  for (const date of dates) {
    const res = await fetch(`${BASE}/api/admin/trigger-cron?cron=sync-gbp&clientId=${CLIENT_ID}&date=${date}`, {
      headers: { 'x-cron-secret': SECRET }
    });
    const flag = res.ok ? '✅' : '❌';
    if (!res.ok) { console.log(`${flag} ${date}: ${res.status}`); fail++; }
    else ok++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  
  // Re-run rollup for Feb 1 - Mar 11
  console.log('\nRe-running rollup for Feb 1 - Mar 11...');
  for (const date of dates) {
    const res = await fetch(`${BASE}/api/admin/run-rollup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': SECRET },
      body: JSON.stringify({ date })
    });
    if (!res.ok) console.log(`❌ rollup ${date}`);
  }
  console.log('Rollup done.');
}
run().catch(console.error);
