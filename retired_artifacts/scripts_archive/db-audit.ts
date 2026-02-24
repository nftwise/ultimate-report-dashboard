import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCount(table: string, timeoutMs = 15000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .abortSignal(controller.signal);

    clearTimeout(timer);
    if (error) return `ERROR: ${error.message}`;
    return String(count);
  } catch (e: any) {
    if (e.name === 'AbortError' || e.message?.includes('abort')) {
      return `TIMED OUT (>${timeoutMs / 1000}s)`;
    }
    return `ERROR: ${e.message}`;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('DATABASE AUDIT - ' + new Date().toISOString());
  console.log('='.repeat(70));

  // ============================================================
  // 1. ROW COUNTS FOR ALL MAIN TABLES
  // ============================================================
  console.log('\n--- 1. ROW COUNTS FOR ALL TABLES ---\n');

  const tables = [
    'clients',
    'client_metrics_summary',
    'ga4_sessions',
    'ga4_events',
    'ga4_landing_pages',
    'ga4_conversions',
    'gsc_pages',
    'gbp_location_daily_metrics',
    'gbp_locations',
    'ads_campaign_metrics',
    'ads_ad_group_metrics',
    'campaign_conversion_actions',
    'campaign_search_terms',
  ];

  for (const table of tables) {
    const count = await getCount(table, 15000);
    console.log(`  ${table.padEnd(35)} ${count}`);
  }

  // ============================================================
  // 2. gsc_queries - try with longer timeout, estimate
  // ============================================================
  console.log('\n--- 2. gsc_queries COUNT (30s timeout) ---\n');
  const gscCount = await getCount('gsc_queries', 30000);
  console.log(`  gsc_queries: ${gscCount}`);

  if (gscCount.includes('TIMED OUT') || gscCount.includes('ERROR')) {
    console.log('  Attempting estimate via sampling...');
    // Count for a few individual dates to estimate avg rows/date
    const testDates = ['2025-01-15', '2025-06-15', '2025-10-15', '2026-01-15'];
    for (const d of testDates) {
      const { count: dc, error: de } = await supabase
        .from('gsc_queries')
        .select('*', { count: 'exact', head: true })
        .eq('date', d);
      if (!de && dc !== null) {
        console.log(`    Rows for date ${d}: ${dc}`);
      } else {
        console.log(`    Rows for date ${d}: ${de ? 'ERROR: ' + de.message : 'null'}`);
      }
    }
    // Try to get approximate count via estimated count (planned count)
    const { count: estCount } = await supabase
      .from('gsc_queries')
      .select('*', { count: 'planned', head: true });
    if (estCount !== null) {
      console.log(`  Planned (estimated) count: ${estCount}`);
    }
    // Get highest ID
    const { data: limitSample } = await supabase
      .from('gsc_queries')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (limitSample && limitSample.length > 0) {
      console.log(`  Highest ID in gsc_queries: ${limitSample[0].id}`);
    }
  }

  // ============================================================
  // 3. campaign_search_terms already counted above; confirm
  // ============================================================
  console.log('\n--- 3. campaign_search_terms (already counted above) ---');

  // ============================================================
  // 4. ga4_events - event types, duplicates, records per client/date
  // ============================================================
  console.log('\n--- 4. ga4_events ANALYSIS ---\n');

  // 4a: unique event names - sample from different ranges to catch all types
  const allEventNames: any[] = [];
  // Sample from beginning, middle, and end
  for (const offset of [0, 50000, 100000, 150000, 200000]) {
    const { data: batch } = await supabase
      .from('ga4_events')
      .select('event_name')
      .range(offset, offset + 999);
    if (batch && batch.length > 0) allEventNames.push(...batch);
  }
  const eventNames = allEventNames;

  const uniqueEvents = new Set<string>();
  (eventNames || []).forEach((e: any) => {
    if (e.event_name) uniqueEvents.add(e.event_name);
  });
  console.log(`  Unique event_name values: ${[...uniqueEvents].join(', ') || 'NONE'}`);
  console.log(`  Total unique: ${uniqueEvents.size}`);
  const isAllAppointment = uniqueEvents.size === 1 && uniqueEvents.has('appointment');
  console.log(`  All events are "appointment"? ${isAllAppointment ? 'YES' : 'NO'}`);

  // 4b: check for duplicates (same client_id, date, event_name, event_count)
  // Fetch from different offsets to get a broader sample
  const eventSampleAll: any[] = [];
  for (const off of [0, 50000, 100000, 150000]) {
    const { data: batch } = await supabase
      .from('ga4_events')
      .select('client_id, date, event_name, event_count')
      .range(off, off + 999);
    if (batch && batch.length > 0) eventSampleAll.push(...batch);
  }
  const eventSample = eventSampleAll;

  if (eventSample && eventSample.length > 0) {
    const seen = new Map<string, number>();
    eventSample.forEach((r: any) => {
      const key = `${r.client_id}|${r.date}|${r.event_name}|${r.event_count}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    const dupes = [...seen.entries()].filter(([, v]) => v > 1);
    console.log(`  Potential duplicates (same client+date+event+count) in sample of ${eventSample.length}: ${dupes.length}`);
    if (dupes.length > 0) {
      console.log(`  First 5 duplicate keys:`);
      dupes.slice(0, 5).forEach(([k, v]) => console.log(`    ${k} (x${v})`));
    }
  }

  // 4c: rows per client per date (reuse eventSample)
  const eventGrouped = eventSample;

  if (eventGrouped && eventGrouped.length > 0) {
    const clientDateCounts = new Map<string, number>();
    eventGrouped.forEach((r: any) => {
      const key = `${r.client_id}|${r.date}`;
      clientDateCounts.set(key, (clientDateCounts.get(key) || 0) + 1);
    });
    const counts = [...clientDateCounts.values()];
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    console.log(`  Rows per client/date: avg=${avg.toFixed(1)}, min=${min}, max=${max} (from ${counts.length} client-date combos)`);
  }

  // ============================================================
  // 5. ga4_sessions - rows per client/date, "(data not available)"
  // ============================================================
  console.log('\n--- 5. ga4_sessions ANALYSIS ---\n');

  const sessionSampleAll: any[] = [];
  for (const off of [0, 20000, 40000, 60000, 80000]) {
    const { data: batch } = await supabase
      .from('ga4_sessions')
      .select('client_id, date, source_medium')
      .range(off, off + 999);
    if (batch && batch.length > 0) sessionSampleAll.push(...batch);
  }
  const sessionSample = sessionSampleAll;

  if (sessionSample && sessionSample.length > 0) {
    // rows per client per date
    const cdCounts = new Map<string, number>();
    let dataNotAvailCount = 0;
    sessionSample.forEach((r: any) => {
      const key = `${r.client_id}|${r.date}`;
      cdCounts.set(key, (cdCounts.get(key) || 0) + 1);
      if (r.source_medium === '(data not available)') dataNotAvailCount++;
    });
    const counts = [...cdCounts.values()];
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    console.log(`  Rows per client/date: avg=${avg.toFixed(1)}, min=${min}, max=${max} (from ${counts.length} client-date combos)`);
    console.log(`  Rows with source_medium "(data not available)": ${dataNotAvailCount} / ${sessionSample.length} (${(dataNotAvailCount * 100 / sessionSample.length).toFixed(1)}%)`);

    // Show top source_medium values
    const smCounts = new Map<string, number>();
    sessionSample.forEach((r: any) => {
      const sm = r.source_medium || '(null)';
      smCounts.set(sm, (smCounts.get(sm) || 0) + 1);
    });
    const sorted = [...smCounts.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  Top 10 source_medium values:`);
    sorted.slice(0, 10).forEach(([k, v]) => {
      console.log(`    ${k}: ${v} (${(v * 100 / sessionSample.length).toFixed(1)}%)`);
    });
  }

  // ============================================================
  // 6. ga4_landing_pages - rows per client per date on average
  // ============================================================
  console.log('\n--- 6. ga4_landing_pages ANALYSIS ---\n');

  const lpSampleAll: any[] = [];
  for (const off of [0, 30000, 60000, 90000, 120000]) {
    const { data: batch } = await supabase
      .from('ga4_landing_pages')
      .select('client_id, date')
      .range(off, off + 999);
    if (batch && batch.length > 0) lpSampleAll.push(...batch);
  }
  const lpSample = lpSampleAll;

  if (lpSample && lpSample.length > 0) {
    const cdCounts = new Map<string, number>();
    lpSample.forEach((r: any) => {
      const key = `${r.client_id}|${r.date}`;
      cdCounts.set(key, (cdCounts.get(key) || 0) + 1);
    });
    const counts = [...cdCounts.values()];
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    console.log(`  Rows per client/date: avg=${avg.toFixed(1)}, min=${min}, max=${max} (from ${counts.length} client-date combos)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
