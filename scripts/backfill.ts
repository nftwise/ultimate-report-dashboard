/**
 * Backfill script — runs a single sync source over a date range.
 * Called per-source by the backfill.yml workflow.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts --source ga4 --group A --start 2026-04-07 --end 2026-04-20
 *   npx tsx scripts/backfill.ts --source fb --start 2026-04-07 --end 2026-04-20
 *   npx tsx scripts/backfill.ts --source rollup --group A --start 2026-04-07 --end 2026-04-20
 */

import { execSync } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const source = process.env.SOURCE || getArg('source') || '';
const group  = process.env.GROUP  || getArg('group')  || '';
const start  = process.env.START  || getArg('start')  || '';
const end    = process.env.END    || getArg('end')    || '';

if (!source || !start || !end) {
  console.error('Usage: backfill.ts --source <ga4|gsc|ads|gbp|fb|rollup> --start YYYY-MM-DD --end YYYY-MM-DD [--group A|B|C]');
  process.exit(1);
}

// Build list of dates from start to end (inclusive)
function dateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const d = new Date(startStr + 'T12:00:00Z');
  const endD = new Date(endStr + 'T12:00:00Z');
  while (d <= endD) {
    dates.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

const dates = dateRange(start, end);
console.log(`[backfill] source=${source} group=${group || 'all'} dates=${dates[0]}→${dates[dates.length - 1]} (${dates.length} days)`);

const scriptMap: Record<string, string> = {
  ga4:    'scripts/sync-ga4.ts',
  gsc:    'scripts/sync-gsc.ts',
  ads:    'scripts/sync-ads.ts',
  gbp:    'scripts/sync-gbp.ts',
  fb:     'scripts/sync-fb-ads.ts',
  rollup: 'scripts/run-rollup.ts',
};

const scriptFile = scriptMap[source];
if (!scriptFile) {
  console.error(`[backfill] Unknown source: ${source}. Valid: ${Object.keys(scriptMap).join(', ')}`);
  process.exit(1);
}

const tsconfig = path.resolve(__dirname, 'tsconfig.json');
let failed = 0;

for (const date of dates) {
  const groupArg = group ? `--group ${group}` : '';
  const cmd = `npx tsx --tsconfig ${tsconfig} ${scriptFile} --date ${date} ${groupArg}`.trim();
  console.log(`\n[backfill] Running: ${date} ${source}${group ? ' Group ' + group : ''}`);

  try {
    execSync(cmd, { stdio: 'inherit', env: process.env });
    console.log(`[backfill] ✓ ${date} ${source} done`);
  } catch {
    console.error(`[backfill] ✗ ${date} ${source} FAILED`);
    failed++;
  }
}

console.log(`\n[backfill] Complete: ${dates.length - failed}/${dates.length} succeeded, ${failed} failed`);
if (failed > 0) process.exit(1);
