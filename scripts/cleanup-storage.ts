#!/usr/bin/env npx tsx
/**
 * Storage Cleanup Script
 *
 * Removes data that is no longer needed after the storage optimization:
 * 1. ga4_events: delete events not in the 3 allowed event types
 * 2. ga4_landing_pages: keep only top 10 per client/date
 * 3. gsc_queries: delete all (will be re-backfilled with filtered data)
 * 4. gsc_pages: delete all (will be re-backfilled with filtered data)
 *
 * Usage:
 *   npx tsx scripts/cleanup-storage.ts
 *   npx tsx scripts/cleanup-storage.ts --dry-run   # preview counts only
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const ALLOWED_EVENTS = ['submit_form_successful', 'Appointment_Successful', 'call_from_web'];
const DELETE_BATCH = 500;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`=== Storage Cleanup ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);
  const startTime = Date.now();

  // ── 1. COUNT BEFORE ────────────────────────────────────────────────
  console.log('Counting rows before cleanup...');
  const [
    { count: eventsTotal },
    { count: landingTotal },
    { count: queriesTotal },
    { count: pagesTotal },
  ] = await Promise.all([
    supabase.from('ga4_events').select('*', { count: 'exact', head: true }),
    supabase.from('ga4_landing_pages').select('*', { count: 'exact', head: true }),
    supabase.from('gsc_queries').select('*', { count: 'exact', head: true }),
    supabase.from('gsc_pages').select('*', { count: 'exact', head: true }),
  ]);
  console.log(`  ga4_events:         ${eventsTotal?.toLocaleString()} rows`);
  console.log(`  ga4_landing_pages:  ${landingTotal?.toLocaleString()} rows`);
  console.log(`  gsc_queries:        ${queriesTotal?.toLocaleString()} rows`);
  console.log(`  gsc_pages:          ${pagesTotal?.toLocaleString()} rows`);
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made. Remove --dry-run to execute.');
    process.exit(0);
  }

  // ── 2. ga4_events: delete non-allowed event types ─────────────────
  console.log('Step 1/4: Deleting ga4_events noise (scroll, click, page_view, etc.)...');
  const { error: eventsError, count: eventsDeleted } = await supabase
    .from('ga4_events')
    .delete({ count: 'exact' })
    .not('event_name', 'in', `(${ALLOWED_EVENTS.join(',')})`)
    .gte('date', '2000-01-01'); // required non-empty filter
  if (eventsError) {
    console.error('  ERROR:', eventsError.message);
  } else {
    console.log(`  Deleted ${eventsDeleted?.toLocaleString()} rows`);
  }

  // ── 3. ga4_landing_pages: keep top 10 per client/date ─────────────
  console.log('\nStep 2/4: Trimming ga4_landing_pages to top 10 per client/date...');
  // Fetch all rows (id, client_id, date, sessions) — needs to be done in JS
  // because Supabase JS client can't do ROW_NUMBER() window functions
  let toDeleteIds: string[] = [];
  let offset = 0;
  const PAGE_SIZE = 5000;
  const allRows: { id: string; client_id: string; date: string; sessions: number }[] = [];

  console.log('  Fetching all landing page rows...');
  while (true) {
    const { data, error } = await supabase
      .from('ga4_landing_pages')
      .select('id, client_id, date, sessions')
      .order('client_id')
      .order('date')
      .order('sessions', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error('  ERROR fetching:', error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`  Fetched ${allRows.length.toLocaleString()} rows`);

  // Group by client_id+date, keep top 10, collect IDs to delete
  const grouped = new Map<string, string[]>(); // key → [ids in rank order]
  for (const row of allRows) {
    const key = `${row.client_id}::${row.date}`;
    const ids = grouped.get(key) || [];
    ids.push(row.id);
    grouped.set(key, ids);
  }
  for (const [, ids] of grouped) {
    if (ids.length > 10) {
      toDeleteIds.push(...ids.slice(10)); // drop everything after rank 10
    }
  }
  console.log(`  Rows to delete: ${toDeleteIds.length.toLocaleString()} (keeping top 10 per client/date)`);

  // Delete in batches of DELETE_BATCH
  let landingDeleted = 0;
  for (let i = 0; i < toDeleteIds.length; i += DELETE_BATCH) {
    const batch = toDeleteIds.slice(i, i + DELETE_BATCH);
    const { error, count } = await supabase
      .from('ga4_landing_pages')
      .delete({ count: 'exact' })
      .in('id', batch);
    if (error) {
      console.error(`  ERROR batch ${Math.floor(i / DELETE_BATCH) + 1}:`, error.message);
    } else {
      landingDeleted += count || 0;
    }
    // Progress every 10 batches
    if ((i / DELETE_BATCH) % 10 === 0) {
      const pct = Math.round((i / toDeleteIds.length) * 100);
      process.stdout.write(`  [${pct}%] ${landingDeleted.toLocaleString()} deleted...\r`);
    }
  }
  console.log(`  Deleted ${landingDeleted.toLocaleString()} rows                     `);

  // ── 4. gsc_queries: delete all rows ───────────────────────────────
  console.log('\nStep 3/4: Deleting all gsc_queries (will be re-backfilled with filtered data)...');
  // Delete in chunks by date range to avoid timeouts on large tables
  const dates = await supabase
    .from('gsc_queries')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);
  const earliestDate = dates.data?.[0]?.date || '2000-01-01';

  const { error: queriesError, count: queriesDeleted } = await supabase
    .from('gsc_queries')
    .delete({ count: 'exact' })
    .gte('date', earliestDate);
  if (queriesError) {
    // If too many rows, fallback to month-by-month
    console.log('  Direct delete may have timed out — trying chunked delete by month...');
    let totalDeleted = 0;
    const months: string[] = [];
    const start = new Date('2025-01-01');
    const end = new Date();
    const cur = new Date(start);
    while (cur <= end) {
      months.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const month of months) {
      const { count, error } = await supabase
        .from('gsc_queries')
        .delete({ count: 'exact' })
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`);
      if (!error) {
        totalDeleted += count || 0;
        console.log(`  ${month}: deleted ${count?.toLocaleString()} rows`);
      }
    }
    console.log(`  Total deleted: ${totalDeleted.toLocaleString()} rows`);
  } else {
    console.log(`  Deleted ${queriesDeleted?.toLocaleString()} rows`);
  }

  // ── 5. gsc_pages: delete all rows ─────────────────────────────────
  console.log('\nStep 4/4: Deleting all gsc_pages (will be re-backfilled with filtered data)...');
  const datesPages = await supabase
    .from('gsc_pages')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);
  const earliestPageDate = datesPages.data?.[0]?.date || '2000-01-01';

  const { error: pagesError, count: pagesDeleted } = await supabase
    .from('gsc_pages')
    .delete({ count: 'exact' })
    .gte('date', earliestPageDate);
  if (pagesError) {
    console.log('  Direct delete may have timed out — trying chunked delete by month...');
    let totalDeleted = 0;
    const months: string[] = [];
    const start = new Date('2025-01-01');
    const end = new Date();
    const cur = new Date(start);
    while (cur <= end) {
      months.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const month of months) {
      const { count, error } = await supabase
        .from('gsc_pages')
        .delete({ count: 'exact' })
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`);
      if (!error) {
        totalDeleted += count || 0;
        console.log(`  ${month}: deleted ${count?.toLocaleString()} rows`);
      }
    }
    console.log(`  Total deleted: ${totalDeleted.toLocaleString()} rows`);
  } else {
    console.log(`  Deleted ${pagesDeleted?.toLocaleString()} rows`);
  }

  // ── 6. COUNT AFTER ─────────────────────────────────────────────────
  console.log('\nCounting rows after cleanup...');
  const [
    { count: eventsAfter },
    { count: landingAfter },
    { count: queriesAfter },
    { count: pagesAfter },
  ] = await Promise.all([
    supabase.from('ga4_events').select('*', { count: 'exact', head: true }),
    supabase.from('ga4_landing_pages').select('*', { count: 'exact', head: true }),
    supabase.from('gsc_queries').select('*', { count: 'exact', head: true }),
    supabase.from('gsc_pages').select('*', { count: 'exact', head: true }),
  ]);
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('========== CLEANUP SUMMARY ==========');
  console.log(`  ga4_events:         ${eventsTotal?.toLocaleString()} → ${eventsAfter?.toLocaleString()} rows (-${(((eventsTotal || 0) - (eventsAfter || 0)) / (eventsTotal || 1) * 100).toFixed(0)}%)`);
  console.log(`  ga4_landing_pages:  ${landingTotal?.toLocaleString()} → ${landingAfter?.toLocaleString()} rows (-${(((landingTotal || 0) - (landingAfter || 0)) / (landingTotal || 1) * 100).toFixed(0)}%)`);
  console.log(`  gsc_queries:        ${queriesTotal?.toLocaleString()} → ${queriesAfter?.toLocaleString()} rows (-${(((queriesTotal || 0) - (queriesAfter || 0)) / (queriesTotal || 1) * 100).toFixed(0)}%)`);
  console.log(`  gsc_pages:          ${pagesTotal?.toLocaleString()} → ${pagesAfter?.toLocaleString()} rows (-${(((pagesTotal || 0) - (pagesAfter || 0)) / (pagesTotal || 1) * 100).toFixed(0)}%)`);
  console.log(`  Duration: ${elapsed}s`);
  console.log('=====================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
