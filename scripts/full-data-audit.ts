import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface TableAudit {
  table: string;
  totalRecords: number;
  minDate: string | null;
  maxDate: string | null;
  totalDaysInRange: number;
  actualDaysWithData: number;
  missingDays: number;
  missingPct: string;
}

const TABLES = [
  'client_metrics_summary',
  'ga4_sessions',
  'gsc_queries',
  'gbp_location_daily_metrics',
  'ads_campaign_metrics',
];

async function auditTable(clientId: string, table: string): Promise<TableAudit> {
  // Get total count
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  const totalRecords = count || 0;

  if (totalRecords === 0) {
    return {
      table,
      totalRecords: 0,
      minDate: null,
      maxDate: null,
      totalDaysInRange: 0,
      actualDaysWithData: 0,
      missingDays: 0,
      missingPct: 'N/A',
    };
  }

  // Get min date
  const { data: minData } = await supabase
    .from(table)
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: true })
    .limit(1);

  // Get max date
  const { data: maxData } = await supabase
    .from(table)
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1);

  const minDate = minData?.[0]?.date || null;
  const maxDate = maxData?.[0]?.date || null;

  // Get distinct dates count - fetch all dates and count unique
  let allDates: string[] = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from(table)
      .select('date')
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;
    allDates.push(...batch.map((r: any) => r.date));
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  const distinctDates = new Set(allDates).size;

  let totalDaysInRange = 0;
  if (minDate && maxDate) {
    const start = new Date(minDate);
    const end = new Date(maxDate);
    totalDaysInRange = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const missingDays = totalDaysInRange - distinctDates;
  const missingPct = totalDaysInRange > 0
    ? ((missingDays / totalDaysInRange) * 100).toFixed(1) + '%'
    : 'N/A';

  return {
    table,
    totalRecords,
    minDate,
    maxDate,
    totalDaysInRange,
    actualDaysWithData: distinctDates,
    missingDays,
    missingPct,
  };
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function rpad(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

async function main() {
  console.log('=== FULL DATA AUDIT ===');
  console.log(`Run date: ${new Date().toISOString()}\n`);

  // Fetch all active clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, slug, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching clients:', error);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('No active clients found.');
    process.exit(0);
  }

  console.log(`Found ${clients.length} active clients.\n`);

  const allResults: { client: ClientInfo; audits: TableAudit[] }[] = [];

  for (const client of clients as ClientInfo[]) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`CLIENT: ${client.name} (slug: ${client.slug})`);
    console.log(`${'='.repeat(100)}`);

    const audits: TableAudit[] = [];
    for (const table of TABLES) {
      const result = await auditTable(client.id, table);
      audits.push(result);
    }

    // Print table
    const hdr = [
      pad('Table', 32),
      rpad('Records', 9),
      pad('Min Date', 12),
      pad('Max Date', 12),
      rpad('Range', 6),
      rpad('Actual', 7),
      rpad('Missing', 8),
      rpad('Miss%', 7),
    ].join(' | ');

    console.log(hdr);
    console.log('-'.repeat(hdr.length));

    for (const a of audits) {
      const row = [
        pad(a.table, 32),
        rpad(String(a.totalRecords), 9),
        pad(a.minDate || '-', 12),
        pad(a.maxDate || '-', 12),
        rpad(String(a.totalDaysInRange), 6),
        rpad(String(a.actualDaysWithData), 7),
        rpad(String(a.missingDays), 8),
        rpad(a.missingPct, 7),
      ].join(' | ');
      console.log(row);
    }

    allResults.push({ client, audits });
  }

  // Final summary
  console.log(`\n\n${'='.repeat(100)}`);
  console.log('FINAL SUMMARY: DATA GAPS BY CLIENT');
  console.log(`${'='.repeat(100)}\n`);

  const summaryHdr = [
    pad('Client', 30),
    rpad('CMS', 6),
    rpad('GA4', 6),
    rpad('GSC', 6),
    rpad('GBP', 6),
    rpad('Ads', 6),
    '  Issues',
  ].join(' | ');

  console.log(summaryHdr);
  console.log('-'.repeat(summaryHdr.length + 20));

  for (const { client, audits } of allResults) {
    const shortNames = ['CMS', 'GA4', 'GSC', 'GBP', 'Ads'];
    const statuses: string[] = [];
    const issues: string[] = [];

    for (let i = 0; i < audits.length; i++) {
      const a = audits[i];
      if (a.totalRecords === 0) {
        statuses.push('EMPTY');
        issues.push(`${shortNames[i]}: NO DATA`);
      } else if (a.missingDays > 30) {
        statuses.push(`${a.missingDays}d`);
        issues.push(`${shortNames[i]}: ${a.missingDays} missing days (${a.missingPct})`);
      } else if (a.missingDays > 0) {
        statuses.push(`${a.missingDays}d`);
      } else {
        statuses.push('OK');
      }
    }

    const row = [
      pad(client.name.substring(0, 30), 30),
      rpad(statuses[0], 6),
      rpad(statuses[1], 6),
      rpad(statuses[2], 6),
      rpad(statuses[3], 6),
      rpad(statuses[4], 6),
      '  ' + (issues.length > 0 ? issues.join('; ') : 'All good'),
    ].join(' | ');
    console.log(row);
  }

  // Overall stats
  console.log(`\n\nOVERALL STATS:`);
  let totalEmpty = 0;
  let totalWithGaps = 0;
  let totalOk = 0;
  for (const { audits } of allResults) {
    for (const a of audits) {
      if (a.totalRecords === 0) totalEmpty++;
      else if (a.missingDays > 0) totalWithGaps++;
      else totalOk++;
    }
  }
  const totalCombinations = allResults.length * TABLES.length;
  console.log(`  Total client x table combinations: ${totalCombinations}`);
  console.log(`  Complete (no gaps): ${totalOk}`);
  console.log(`  Has gaps: ${totalWithGaps}`);
  console.log(`  Empty (no data): ${totalEmpty}`);
}

main().catch(console.error);
