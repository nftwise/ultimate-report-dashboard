/**
 * audit-and-backfill-12months.mjs
 *
 * Task 1: Audit gaps in raw tables (GA4, GSC, Ads) for Apr 2025 → Mar 2026
 * Task 2: Backfill missing months by calling sync endpoints
 * Task 3: Report results
 */

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const PROD_URL = 'https://ultimate-report-dashboard.vercel.app';

// Months to audit: Apr 2025 → Mar 2026
const MONTHS = [];
for (let m = 4; m <= 12; m++) {
  MONTHS.push({ year: 2025, month: m });
}
for (let m = 1; m <= 3; m++) {
  MONTHS.push({ year: 2026, month: m });
}

function pad(n) { return String(n).padStart(2, '0'); }

function monthLabel(year, month) {
  return `${year}-${pad(month)}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthStart(year, month) {
  return `${year}-${pad(month)}-01`;
}

function monthEnd(year, month) {
  const days = getDaysInMonth(year, month);
  return `${year}-${pad(month)}-${pad(days)}`;
}

// Supabase REST query
async function supabaseQuery(table, select, filters = {}, options = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

  for (const [key, val] of Object.entries(filters)) {
    url += `&${key}=${encodeURIComponent(val)}`;
  }

  if (options.count) {
    url += `&limit=0`;
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  if (options.count) {
    headers['Prefer'] = 'count=exact';
  }

  const res = await fetch(url, { headers });

  if (options.count) {
    const countHeader = res.headers.get('content-range');
    // content-range: 0-0/123 or */123
    const total = countHeader ? parseInt(countHeader.split('/')[1]) : 0;
    return { count: isNaN(total) ? 0 : total };
  }

  const data = await res.json();
  return data;
}

// Count rows for a table in a date range
async function countRows(table, dateColumn, startDate, endDate, extraFilters = '') {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&${dateColumn}=gte.${startDate}&${dateColumn}=lte.${endDate}${extraFilters}&limit=0`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'count=exact',
    }
  });

  const countHeader = res.headers.get('content-range');
  if (!countHeader) return 0;
  const total = parseInt(countHeader.split('/')[1]);
  return isNaN(total) ? 0 : total;
}

// Call a sync endpoint with delay
async function callSyncEndpoint(path, date, delayMs = 4000) {
  const url = `${PROD_URL}${path}?date=${date}`;
  process.stdout.write(`  → Calling ${path}?date=${date} ... `);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'audit-backfill-script/1.0' },
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }

    const status = res.status;
    if (status === 200) {
      process.stdout.write(`OK (${status})\n`);
    } else {
      process.stdout.write(`WARN status=${status}\n`);
      console.log(`    Response: ${JSON.stringify(json).slice(0, 300)}`);
    }

    await new Promise(r => setTimeout(r, delayMs));
    return { ok: status < 400, status, response: json };
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    await new Promise(r => setTimeout(r, delayMs));
    return { ok: false, error: err.message };
  }
}

// ─── TASK 1: AUDIT ───────────────────────────────────────────────────────────

async function auditGaps() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          TASK 1: AUDIT DATA GAPS (Apr 2025 → Mar 2026)      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = {
    ga4: {},
    gsc: {},
    ads: {},
  };

  // ── GA4 Sessions ──────────────────────────────────────────────────────────
  console.log('Auditing GA4 (ga4_sessions) per month...');
  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const start = monthStart(year, month);
    const end = monthEnd(year, month);
    const count = await countRows('ga4_sessions', 'date', start, end);
    results.ga4[label] = count;
    const flag = count === 0 ? ' ← MISSING!' : (count < 100 ? ' ← LOW' : '');
    console.log(`  GA4  ${label}: ${count.toLocaleString()} rows${flag}`);
  }

  // ── GSC Daily Summary ─────────────────────────────────────────────────────
  console.log('\nAuditing GSC (gsc_daily_summary) per month...');
  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const start = monthStart(year, month);
    const end = monthEnd(year, month);
    const count = await countRows('gsc_daily_summary', 'date', start, end);
    results.gsc[label] = count;
    const flag = count === 0 ? ' ← MISSING!' : (count < 50 ? ' ← LOW' : '');
    console.log(`  GSC  ${label}: ${count.toLocaleString()} rows${flag}`);
  }

  // ── Ads Campaign Metrics ──────────────────────────────────────────────────
  console.log('\nAuditing Ads (ads_campaign_metrics) per month...');
  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const start = monthStart(year, month);
    const end = monthEnd(year, month);
    const count = await countRows('ads_campaign_metrics', 'date', start, end);
    results.ads[label] = count;
    const flag = count === 0 ? ' ← MISSING!' : (count < 20 ? ' ← LOW' : '');
    console.log(`  ADS  ${label}: ${count.toLocaleString()} rows${flag}`);
  }

  // Print summary table
  console.log('\n┌────────────┬────────────┬────────────┬────────────┐');
  console.log('│   Month    │  GA4 rows  │  GSC rows  │  Ads rows  │');
  console.log('├────────────┼────────────┼────────────┼────────────┤');
  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const ga4 = results.ga4[label] || 0;
    const gsc = results.gsc[label] || 0;
    const ads = results.ads[label] || 0;
    const g = ga4 === 0 ? '   MISSING  ' : String(ga4.toLocaleString()).padStart(10, ' ') + '  ';
    const s = gsc === 0 ? '   MISSING  ' : String(gsc.toLocaleString()).padStart(10, ' ') + '  ';
    const a = ads === 0 ? '   MISSING  ' : String(ads.toLocaleString()).padStart(10, ' ') + '  ';
    console.log(`│ ${label}   │ ${g}│ ${s}│ ${a}│`);
  }
  console.log('└────────────┴────────────┴────────────┴────────────┘');

  return results;
}

// ─── TASK 2: BACKFILL ─────────────────────────────────────────────────────

async function backfill(auditResults) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   TASK 2: BACKFILL MISSING DATA             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const backfillStats = {
    ga4: { months: 0, calls: 0 },
    gsc: { months: 0, calls: 0 },
    ads: { months: 0, calls: 0 },
    rollup: { calls: 0 },
  };

  const rollupDates = new Set();

  // Identify missing months
  const missingGA4 = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    return (auditResults.ga4[label] || 0) === 0;
  });

  const missingGSC = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    return (auditResults.gsc[label] || 0) === 0;
  });

  const missingAds = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    return (auditResults.ads[label] || 0) === 0;
  });

  const lowGA4 = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    const count = auditResults.ga4[label] || 0;
    return count > 0 && count < 100;
  });

  const lowGSC = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    const count = auditResults.gsc[label] || 0;
    return count > 0 && count < 50;
  });

  const lowAds = MONTHS.filter(({ year, month }) => {
    const label = monthLabel(year, month);
    const count = auditResults.ads[label] || 0;
    return count > 0 && count < 20;
  });

  console.log(`Missing GA4 months: ${missingGA4.length} (${missingGA4.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);
  console.log(`Missing GSC months: ${missingGSC.length} (${missingGSC.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);
  console.log(`Missing Ads months: ${missingAds.length} (${missingAds.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);
  console.log(`Low GA4 months: ${lowGA4.length} (${lowGA4.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);
  console.log(`Low GSC months: ${lowGSC.length} (${lowGSC.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);
  console.log(`Low Ads months: ${lowAds.length} (${lowAds.map(m => monthLabel(m.year, m.month)).join(', ') || 'none'})`);

  // Backfill GA4 missing months - call 1st, 10th, 20th of each month as representatives
  if (missingGA4.length > 0) {
    console.log('\n── Backfilling GA4 missing months ──');
    for (const { year, month } of missingGA4) {
      const label = monthLabel(year, month);
      console.log(`\n  Month: ${label}`);
      const daysInMonth = getDaysInMonth(year, month);
      // Call every day of the missing month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${pad(month)}-${pad(day)}`;
        await callSyncEndpoint('/api/cron/sync-ga4', date, 3000);
        rollupDates.add(date);
        backfillStats.ga4.calls++;
      }
      backfillStats.ga4.months++;
    }
  }

  // Backfill GSC missing months
  if (missingGSC.length > 0) {
    console.log('\n── Backfilling GSC missing months ──');
    for (const { year, month } of missingGSC) {
      const label = monthLabel(year, month);
      console.log(`\n  Month: ${label}`);
      const daysInMonth = getDaysInMonth(year, month);
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${pad(month)}-${pad(day)}`;
        await callSyncEndpoint('/api/cron/sync-gsc', date, 3000);
        rollupDates.add(date);
        backfillStats.gsc.calls++;
      }
      backfillStats.gsc.months++;
    }
  }

  // Backfill Ads missing months
  if (missingAds.length > 0) {
    console.log('\n── Backfilling Ads missing months ──');
    for (const { year, month } of missingAds) {
      const label = monthLabel(year, month);
      console.log(`\n  Month: ${label}`);
      const daysInMonth = getDaysInMonth(year, month);
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${pad(month)}-${pad(day)}`;
        await callSyncEndpoint('/api/cron/sync-ads', date, 3000);
        rollupDates.add(date);
        backfillStats.ads.calls++;
      }
      backfillStats.ads.months++;
    }
  }

  if (missingGA4.length === 0 && missingGSC.length === 0 && missingAds.length === 0) {
    console.log('\nNo completely missing months found — checking low-count months...');

    // For low months, re-sync the first and last day of month as a spot-check
    const allLow = [...new Set([...lowGA4, ...lowGSC, ...lowAds].map(m => monthLabel(m.year, m.month)))];
    if (allLow.length > 0) {
      console.log(`Low-count months to investigate: ${allLow.join(', ')}`);
      console.log('Skipping re-sync of low months (data exists, may be partial source coverage)');
    } else {
      console.log('All months have data. No backfill needed!');
    }
  }

  // Run rollup for all backfilled dates
  if (rollupDates.size > 0) {
    console.log(`\n── Running rollup for ${rollupDates.size} backfilled dates ──`);
    const sortedDates = Array.from(rollupDates).sort();

    // Run rollup in batches of 7 (once per week is enough for summary table)
    const rollupSample = [];
    for (let i = 0; i < sortedDates.length; i += 7) {
      rollupSample.push(sortedDates[i]);
    }
    // Always include last date
    if (rollupSample[rollupSample.length - 1] !== sortedDates[sortedDates.length - 1]) {
      rollupSample.push(sortedDates[sortedDates.length - 1]);
    }

    console.log(`Running rollup for ${rollupSample.length} sample dates (every 7 days)...`);
    for (const date of rollupSample) {
      await callSyncEndpoint('/api/admin/run-rollup', date, 4000);
      backfillStats.rollup.calls++;
    }
  }

  return backfillStats;
}

// ─── TASK 3: POST-BACKFILL AUDIT ─────────────────────────────────────────────

async function postBackfillAudit(beforeResults) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              TASK 3: POST-BACKFILL VERIFICATION             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const afterResults = {
    ga4: {},
    gsc: {},
    ads: {},
  };

  console.log('Re-counting rows after backfill...\n');

  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const start = monthStart(year, month);
    const end = monthEnd(year, month);

    afterResults.ga4[label] = await countRows('ga4_sessions', 'date', start, end);
    afterResults.gsc[label] = await countRows('gsc_daily_summary', 'date', start, end);
    afterResults.ads[label] = await countRows('ads_campaign_metrics', 'date', start, end);
  }

  // Print comparison table
  console.log('\n┌────────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┐');
  console.log('│   Month    │         GA4 rows         │         GSC rows         │         Ads rows         │');
  console.log('│            │   Before  →   After      │   Before  →   After      │   Before  →   After      │');
  console.log('├────────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┤');

  let totalGA4Added = 0, totalGSCAdded = 0, totalAdsAdded = 0;

  for (const { year, month } of MONTHS) {
    const label = monthLabel(year, month);
    const ga4Before = beforeResults.ga4[label] || 0;
    const ga4After = afterResults.ga4[label] || 0;
    const gscBefore = beforeResults.gsc[label] || 0;
    const gscAfter = afterResults.gsc[label] || 0;
    const adsBefore = beforeResults.ads[label] || 0;
    const adsAfter = afterResults.ads[label] || 0;

    totalGA4Added += ga4After - ga4Before;
    totalGSCAdded += gscAfter - gscBefore;
    totalAdsAdded += adsAfter - adsBefore;

    const ga4Status = ga4After > ga4Before ? '✓' : (ga4After === 0 ? '✗' : '=');
    const gscStatus = gscAfter > gscBefore ? '✓' : (gscAfter === 0 ? '✗' : '=');
    const adsStatus = adsAfter > adsBefore ? '✓' : (adsAfter === 0 ? '✗' : '=');

    console.log(`│ ${label}   │ ${String(ga4Before).padStart(7)} → ${String(ga4After).padStart(7)} ${ga4Status}     │ ${String(gscBefore).padStart(7)} → ${String(gscAfter).padStart(7)} ${gscStatus}     │ ${String(adsBefore).padStart(7)} → ${String(adsAfter).padStart(7)} ${adsStatus}     │`);
  }

  console.log('└────────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┘');
  console.log(`\nTotal rows added: GA4 +${totalGA4Added.toLocaleString()} | GSC +${totalGSCAdded.toLocaleString()} | Ads +${totalAdsAdded.toLocaleString()}`);

  // Flag still-missing
  const stillMissingGA4 = MONTHS.filter(({ year, month }) => (afterResults.ga4[monthLabel(year, month)] || 0) === 0);
  const stillMissingGSC = MONTHS.filter(({ year, month }) => (afterResults.gsc[monthLabel(year, month)] || 0) === 0);
  const stillMissingAds = MONTHS.filter(({ year, month }) => (afterResults.ads[monthLabel(year, month)] || 0) === 0);

  if (stillMissingGA4.length > 0) {
    console.log(`\nWARNING: GA4 still missing data for: ${stillMissingGA4.map(m => monthLabel(m.year, m.month)).join(', ')}`);
  }
  if (stillMissingGSC.length > 0) {
    console.log(`WARNING: GSC still missing data for: ${stillMissingGSC.map(m => monthLabel(m.year, m.month)).join(', ')}`);
  }
  if (stillMissingAds.length > 0) {
    console.log(`WARNING: Ads still missing data for: ${stillMissingAds.map(m => monthLabel(m.year, m.month)).join(', ')}`);
  }

  if (stillMissingGA4.length === 0 && stillMissingGSC.length === 0 && stillMissingAds.length === 0) {
    console.log('\nAll months have data across all three sources.');
  }

  return { afterResults, totalGA4Added, totalGSCAdded, totalAdsAdded };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ULTIMATE REPORT DASHBOARD — 12-MONTH DATA AUDIT & BACKFILL');
  console.log(' Period: Apr 2025 → Mar 2026');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  // Task 1: Audit
  const beforeResults = await auditGaps();

  // Task 2: Backfill
  const backfillStats = await backfill(beforeResults);

  // Task 3: Post-backfill report
  const postReport = await postBackfillAudit(beforeResults);

  // Final summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      FINAL SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  GA4 backfill:  ${backfillStats.ga4.months} months, ${backfillStats.ga4.calls} API calls, +${postReport.totalGA4Added.toLocaleString()} rows`);
  console.log(`  GSC backfill:  ${backfillStats.gsc.months} months, ${backfillStats.gsc.calls} API calls, +${postReport.totalGSCAdded.toLocaleString()} rows`);
  console.log(`  Ads backfill:  ${backfillStats.ads.months} months, ${backfillStats.ads.calls} API calls, +${postReport.totalAdsAdded.toLocaleString()} rows`);
  console.log(`  Rollup calls:  ${backfillStats.rollup.calls}`);
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
