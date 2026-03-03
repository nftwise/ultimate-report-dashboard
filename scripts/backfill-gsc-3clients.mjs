/**
 * Backfill GSC data for 3 clients: Jan 2025 → Feb 28 2026
 * Clients: Chiropractic First, Southport Chiropractic, Tails Animal Chiropractic Care
 */
import { createClient } from '@supabase/supabase-js';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, '')]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CLIENTS = [
  { id: '1358cdb0-63d3-47b4-bc74-decd60a2e25b', name: 'Chiropractic First',          siteUrl: 'https://chirofirstredding.com/', city: 'Redding' },
  { id: '721e3508-6e54-4295-8e24-426c4f8cef2a', name: 'Southport Chiropractic',       siteUrl: 'https://chiroct.com/',           city: 'Southport' },
  { id: 'be9bfb4b-419c-40ca-bf29-39157875d471', name: 'Tails Animal Chiropractic',    siteUrl: 'https://tailschirocare.com/',    city: '' },
];

const START_DATE = '2025-01-01';
const END_DATE   = '2026-02-28'; // GSC API ~2-3 day lag
const TIMEOUT_MS = 20000;

// Build date array
function buildDates(start, end) {
  const dates = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function fetchGSCQueries(token, client, date) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const encoded = encodeURIComponent(client.siteUrl);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: date, endDate: date, dimensions: ['query'], rowLimit: 5000, dataState: 'final' }),
        signal: controller.signal,
      }
    );
    clearTimeout(tid);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${res.status} ${err?.error?.message || ''}`);
    }
    const data = await res.json();
    const rows = data.rows || [];

    // Top 50 by impressions + city queries
    const top50 = [...rows].sort((a, b) => (b.impressions||0) - (a.impressions||0)).slice(0, 50);
    const seen = new Set(top50.map(r => r.keys[0]));
    const cityKw = client.city.toLowerCase().trim();
    const cityRows = cityKw
      ? rows.filter(r => !seen.has(r.keys[0]) && r.keys[0].toLowerCase().includes(cityKw))
      : [];
    const filtered = [...top50, ...cityRows];

    return { all: rows, filtered };
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

async function run() {
  // Get token
  const key = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const auth = new JWT({ email: env.GOOGLE_CLIENT_EMAIL, key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  const { token } = await auth.getAccessToken();

  const dates = buildDates(START_DATE, END_DATE);
  console.log(`[backfill-gsc] ${CLIENTS.length} clients × ${dates.length} dates = ${CLIENTS.length * dates.length} requests`);
  console.log(`[backfill-gsc] Date range: ${START_DATE} → ${END_DATE}`);
  console.log('');

  let totalRows = 0;
  let errors = 0;
  let skipped = 0; // dates with 0 rows (normal for early dates)

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const pct = Math.round((di / dates.length) * 100);

    for (const client of CLIENTS) {
      try {
        const { all, filtered } = await fetchGSCQueries(token, client, date);

        if (all.length === 0) {
          skipped++;
          continue;
        }

        // Save daily summary
        const { error: sumErr } = await supabase.from('gsc_daily_summary').upsert({
          client_id: client.id,
          site_url: client.siteUrl,
          date,
          total_impressions: all.reduce((s, r) => s + (r.impressions||0), 0),
          total_clicks:      all.reduce((s, r) => s + (r.clicks||0), 0),
          top_keywords_count: all.filter(r => (r.position||999) <= 10).length,
        }, { onConflict: 'client_id,site_url,date' });
        if (sumErr) console.error(`  summary err ${client.name} ${date}:`, sumErr.message);

        // Save queries (batched 500)
        const queryRows = filtered.map(r => ({
          client_id: client.id,
          site_url: client.siteUrl,
          date,
          query:       r.keys[0] || '',
          clicks:      r.clicks || 0,
          impressions: r.impressions || 0,
          ctr:         Math.round((r.ctr||0) * 10000) / 100,
          position:    Math.round((r.position||0) * 10) / 10,
        }));

        for (let j = 0; j < queryRows.length; j += 500) {
          const { error: qErr } = await supabase.from('gsc_queries')
            .upsert(queryRows.slice(j, j + 500), { onConflict: 'client_id,site_url,date,query' });
          if (qErr) console.error(`  queries err ${client.name} ${date}:`, qErr.message);
        }

        totalRows += queryRows.length;
        if (di % 30 === 0 || di === dates.length - 1) {
          console.log(`[${pct}%] ${date} | ${client.name}: ${all.length} queries → ${queryRows.length} saved`);
        }

      } catch (e) {
        errors++;
        if (errors <= 20) console.error(`  ERR ${client.name} ${date}: ${e.message}`);
      }
    }

    // Small delay every 10 dates to avoid rate limiting
    if (di % 10 === 9) await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
  console.log(`[backfill-gsc] DONE`);
  console.log(`  Total query rows saved: ${totalRows}`);
  console.log(`  Empty dates (no data):  ${skipped}`);
  console.log(`  Errors:                 ${errors}`);
  console.log('');
  console.log('[backfill-gsc] Now run rollup to update client_metrics_summary...');

  // Trigger rollup for all dates
  const rollupDates = buildDates(START_DATE, END_DATE);
  console.log(`[backfill-gsc] Triggering rollup for ${rollupDates.length} dates...`);

  // Call rollup API for chunks (run-rollup processes one date at a time)
  let rollupOk = 0;
  for (const date of rollupDates) {
    try {
      const res = await fetch(`${env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/run-rollup`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).catch(() => null);
      // rollup via supabase directly instead
      rollupOk++;
    } catch {}
  }

  console.log('[backfill-gsc] Rollup note: GSC data goes into gsc_daily_summary which feeds top_keywords in rollup.');
  console.log('[backfill-gsc] Run the rollup from Cron Monitor (Rollup Backfill Jan 2025 → Feb 2026) to update client_metrics_summary.');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
