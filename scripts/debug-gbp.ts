import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JAN_START = '2026-01-01';
const JAN_END = '2026-01-31';

async function main() {
  console.log('='.repeat(80));
  console.log('GBP PHONE CALL DATA DIAGNOSTIC');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────
  // 1. Show gbp_location_daily_metrics table structure via a sample row
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: gbp_location_daily_metrics - ALL COLUMNS (sample row)');
  console.log('='.repeat(80));

  const { data: sampleRow, error: sampleErr } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (sampleErr) {
    console.log('Error fetching sample:', sampleErr.message);
  } else {
    console.log('Columns:', Object.keys(sampleRow!));
    console.log('Sample row:');
    console.log(JSON.stringify(sampleRow, null, 2));
  }

  // ──────────────────────────────────────────────────────
  // 2. Compare gbp_calls (summary) vs phone_calls (gbp detail) for ALL active clients, Jan 2026
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: COMPARE client_metrics_summary.gbp_calls vs gbp_location_daily_metrics.phone_calls');
  console.log(`Date range: ${JAN_START} to ${JAN_END}`);
  console.log('='.repeat(80));

  // Get all active clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name');

  if (!clients || clients.length === 0) {
    console.log('No active clients found!');
    return;
  }

  console.log(`\nFound ${clients.length} active clients\n`);

  // For each client, get summary calls and detail calls
  const results: Array<{
    name: string;
    slug: string;
    summaryCalls: number;
    detailCalls: number;
    detailDays: number;
    summaryDays: number;
    diff: number;
    diffPct: string;
  }> = [];

  for (const client of clients) {
    // Summary table: SUM(gbp_calls)
    const { data: summaryData } = await supabase
      .from('client_metrics_summary')
      .select('gbp_calls, date')
      .eq('client_id', client.id)
      .gte('date', JAN_START)
      .lte('date', JAN_END);

    const summaryCalls = (summaryData || []).reduce((sum, r) => sum + (r.gbp_calls || 0), 0);
    const summaryDays = (summaryData || []).filter(r => r.gbp_calls !== null && r.gbp_calls !== undefined).length;

    // Detail table: SUM(phone_calls)
    const { data: detailData } = await supabase
      .from('gbp_location_daily_metrics')
      .select('phone_calls, date')
      .eq('client_id', client.id)
      .gte('date', JAN_START)
      .lte('date', JAN_END);

    const detailCalls = (detailData || []).reduce((sum, r) => sum + (r.phone_calls || 0), 0);
    const detailDays = (detailData || []).length;

    const diff = summaryCalls - detailCalls;
    const diffPct = detailCalls > 0
      ? ((diff / detailCalls) * 100).toFixed(1) + '%'
      : summaryCalls > 0 ? 'INF% (detail=0)' : 'N/A';

    results.push({
      name: client.name,
      slug: client.slug,
      summaryCalls,
      detailCalls,
      detailDays,
      summaryDays,
      diff,
      diffPct,
    });
  }

  // Print table
  console.log(
    'Client'.padEnd(35) +
    'Summary'.padStart(10) +
    'Detail'.padStart(10) +
    'Diff'.padStart(10) +
    'Diff%'.padStart(12) +
    'SumDays'.padStart(10) +
    'DetDays'.padStart(10)
  );
  console.log('-'.repeat(97));

  for (const r of results) {
    console.log(
      r.name.substring(0, 34).padEnd(35) +
      String(r.summaryCalls).padStart(10) +
      String(r.detailCalls).padStart(10) +
      String(r.diff).padStart(10) +
      r.diffPct.padStart(12) +
      String(r.summaryDays).padStart(10) +
      String(r.detailDays).padStart(10)
    );
  }

  // Summary
  const totalSummary = results.reduce((s, r) => s + r.summaryCalls, 0);
  const totalDetail = results.reduce((s, r) => s + r.detailCalls, 0);
  console.log('-'.repeat(97));
  console.log(
    'TOTAL'.padEnd(35) +
    String(totalSummary).padStart(10) +
    String(totalDetail).padStart(10) +
    String(totalSummary - totalDetail).padStart(10) +
    (totalDetail > 0 ? (((totalSummary - totalDetail) / totalDetail) * 100).toFixed(1) + '%' : 'N/A').padStart(12)
  );

  // ──────────────────────────────────────────────────────
  // 3. Daily breakdown for top 5 clients with GBP data (Jan 1-7)
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('STEP 3: DAILY BREAKDOWN (Jan 1-7) - ALL columns from gbp_location_daily_metrics');
  console.log('='.repeat(80));

  const clientsWithData = results
    .filter(r => r.detailDays > 0)
    .sort((a, b) => b.detailCalls - a.detailCalls)
    .slice(0, 5);

  for (const clientInfo of clientsWithData) {
    const client = clients.find(c => c.slug === clientInfo.slug)!;

    console.log(`\n--- ${clientInfo.name} (${clientInfo.slug}) ---`);

    const { data: dailyData } = await supabase
      .from('gbp_location_daily_metrics')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', '2026-01-01')
      .lte('date', '2026-01-07')
      .order('date', { ascending: true });

    if (!dailyData || dailyData.length === 0) {
      console.log('  No data for Jan 1-7');
      continue;
    }

    for (const row of dailyData) {
      console.log(JSON.stringify(row, null, 2));
    }

    // Also show what client_metrics_summary has for same dates
    console.log(`\n  >>> client_metrics_summary for same dates:`);
    const { data: summaryDaily } = await supabase
      .from('client_metrics_summary')
      .select('date, gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
      .eq('client_id', client.id)
      .gte('date', '2026-01-01')
      .lte('date', '2026-01-07')
      .order('date', { ascending: true });

    for (const row of summaryDaily || []) {
      console.log(`  ${row.date}: calls=${row.gbp_calls}, clicks=${row.gbp_website_clicks}, dirs=${row.gbp_directions}, views=${row.gbp_profile_views}`);
    }
  }

  // ──────────────────────────────────────────────────────
  // 4. Check for duplicate rows (multiple rows per client per date)
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('STEP 4: CHECK FOR DUPLICATE ROWS in gbp_location_daily_metrics');
  console.log('(Multiple rows per client_id + date could cause double counting)');
  console.log('='.repeat(80));

  // We can't do GROUP BY HAVING in supabase-js directly, so we'll use RPC or raw query
  // Alternative: fetch all and group in JS
  const { data: allGbpJan } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, date, location_id')
    .gte('date', JAN_START)
    .lte('date', JAN_END);

  if (allGbpJan) {
    // Group by client_id + date
    const countMap = new Map<string, { count: number; locationIds: string[] }>();
    for (const row of allGbpJan) {
      const key = `${row.client_id}|${row.date}`;
      const entry = countMap.get(key) || { count: 0, locationIds: [] };
      entry.count++;
      entry.locationIds.push(row.location_id);
      countMap.set(key, entry);
    }

    const duplicates = Array.from(countMap.entries())
      .filter(([, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count);

    if (duplicates.length === 0) {
      console.log('\nNo duplicates found (each client has at most 1 row per date).');
    } else {
      console.log(`\nFOUND ${duplicates.length} client+date combos with MULTIPLE rows!`);
      console.log('This means data is being DOUBLE COUNTED.\n');

      // Show details for first 20
      const showCount = Math.min(20, duplicates.length);
      for (let i = 0; i < showCount; i++) {
        const [key, val] = duplicates[i];
        const [clientId, date] = key.split('|');
        const clientName = clients.find(c => c.id === clientId)?.name || clientId;
        console.log(`  ${clientName} | ${date} | ${val.count} rows | location_ids: ${val.locationIds.join(', ')}`);
      }

      if (duplicates.length > 20) {
        console.log(`  ... and ${duplicates.length - 20} more`);
      }

      // Summarize: how many unique clients have duplicates?
      const clientsWithDupes = new Set(duplicates.map(([k]) => k.split('|')[0]));
      console.log(`\n  ${clientsWithDupes.size} clients have duplicate rows`);
      console.log(`  Total duplicate date entries: ${duplicates.length}`);

      // Show the actual duplicate rows for the worst case
      const [worstKey] = duplicates[0];
      const [worstClientId, worstDate] = worstKey.split('|');
      console.log(`\n  Worst case detail (${clients.find(c => c.id === worstClientId)?.name}, ${worstDate}):`);

      const { data: dupeRows } = await supabase
        .from('gbp_location_daily_metrics')
        .select('*')
        .eq('client_id', worstClientId)
        .eq('date', worstDate);

      for (const row of dupeRows || []) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
  }

  // ──────────────────────────────────────────────────────
  // 5. Show what the GBP sync cron stores (already read the file, summarize key findings)
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('STEP 5: GBP SYNC CRON ANALYSIS');
  console.log('File: src/app/api/cron/sync-gbp/route.ts');
  console.log('='.repeat(80));

  console.log(`
KEY FINDINGS from sync-gbp/route.ts:

1. METRIC MAPPING:
   - phone_calls = CALL_CLICKS (from GBP Performance API)
   - website_clicks = WEBSITE_CLICKS
   - direction_requests = BUSINESS_DIRECTION_REQUESTS
   - views = sum of all 4 impression metrics (desktop/mobile maps/search)
   - actions = website_clicks + direction_requests + phone_calls

2. UPSERT CONFLICT KEY: 'location_id,date'
   - This means ONE row per location per date
   - If a client has MULTIPLE locations, there will be MULTIPLE rows per client per date
   - This is the likely cause of "double counting" if the dashboard SUMs without deduplication

3. DATA SOURCE:
   - Uses GBP Performance API v1 getDailyMetricsTimeSeries
   - Fetches for single day (yesterday)
   - Processes in batches of 3

4. POTENTIAL ISSUE:
   - The upsert key is (location_id, date) NOT (client_id, date)
   - A client with 2 GBP locations will have 2 rows per date
   - If phone_calls for each location = e.g. 5, SUM = 10
   - But client_metrics_summary may only store the value from ONE location
   - OR client_metrics_summary may be rolling up correctly and gbp detail has multiple locations
  `);

  // Check: how many GBP locations per client?
  console.log('\nGBP LOCATIONS PER CLIENT:');
  const { data: locations } = await supabase
    .from('gbp_locations')
    .select('client_id, gbp_location_id, location_name, is_active')
    .eq('is_active', true);

  if (locations) {
    const locByClient = new Map<string, string[]>();
    for (const loc of locations) {
      const arr = locByClient.get(loc.client_id) || [];
      arr.push(loc.location_name || loc.gbp_location_id);
      locByClient.set(loc.client_id, arr);
    }

    for (const [clientId, locs] of locByClient) {
      const clientName = clients.find(c => c.id === clientId)?.name || clientId;
      console.log(`  ${clientName}: ${locs.length} location(s) => ${locs.join(', ')}`);
    }
  }

  // ──────────────────────────────────────────────────────
  // BONUS: Check the rollup logic - how does client_metrics_summary get gbp_calls?
  // ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('BONUS: Check nightly-metrics-rollup for how gbp_calls is computed');
  console.log('='.repeat(80));

  // We'll just note the file path - the user can inspect it
  console.log('Check: scripts/nightly-metrics-rollup.ts');
  console.log('Check: src/app/api/cron/ for any rollup cron');

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
