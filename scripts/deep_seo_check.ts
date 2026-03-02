import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clients } = await sb.from('clients').select('id,name,slug').eq('is_active', true);
  const nm = new Map((clients || []).map((c: any) => [c.id, c.name]));

  console.log('\n========================================');
  console.log('DEEP SEO DATA CHECK');
  console.log('========================================\n');

  // ── 1. GSC data coverage ─────────────────────────────────────────────────
  console.log('=== 1. GSC DATA COVERAGE (gsc_queries) ===');
  let all: any[] = [], from = 0;
  while (true) {
    const { data } = await sb.from('gsc_queries')
      .select('client_id,date')
      .gte('date', '2026-01-01')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const gscByClient: Record<string, { minDate: string; maxDate: string; rows: number }> = {};
  for (const r of all) {
    if (!gscByClient[r.client_id]) gscByClient[r.client_id] = { minDate: r.date, maxDate: r.date, rows: 0 };
    if (r.date < gscByClient[r.client_id].minDate) gscByClient[r.client_id].minDate = r.date;
    if (r.date > gscByClient[r.client_id].maxDate) gscByClient[r.client_id].maxDate = r.date;
    gscByClient[r.client_id].rows++;
  }
  console.log(`  Total gsc_queries rows (Jan 2026+): ${all.length}`);
  const noGsc = (clients || []).filter((c: any) => !gscByClient[c.id]);
  console.log(`  Clients with NO GSC data: ${noGsc.length}`);
  noGsc.forEach((c: any) => console.log(`    - ${c.name}`));
  console.log(`  Clients with GSC data: ${Object.keys(gscByClient).length}`);
  Object.entries(gscByClient).forEach(([cid, v]) => {
    console.log(`    ${nm.get(cid)?.padEnd(35)} rows=${String(v.rows).padStart(5)}  range=${v.minDate} → ${v.maxDate}`);
  });

  // ── 2. GSC daily summary ─────────────────────────────────────────────────
  console.log('\n=== 2. GSC DAILY SUMMARY COVERAGE ===');
  const { data: gscSum } = await sb.from('gsc_daily_summary')
    .select('client_id,date,total_clicks,total_impressions,avg_position')
    .gte('date', '2026-02-01')
    .order('date', { ascending: false });
  const gscSumByClient: Record<string, { latest: string; count: number }> = {};
  for (const r of gscSum || []) {
    if (!gscSumByClient[r.client_id]) gscSumByClient[r.client_id] = { latest: r.date, count: 0 };
    gscSumByClient[r.client_id].count++;
  }
  const noGscSum = (clients || []).filter((c: any) => !gscSumByClient[c.id]);
  console.log(`  Clients with NO gsc_daily_summary: ${noGscSum.length}`);
  noGscSum.forEach((c: any) => console.log(`    - ${c.name}`));
  Object.entries(gscSumByClient).forEach(([cid, v]) => {
    console.log(`    ${nm.get(cid)?.padEnd(35)} count=${v.count}  latest=${v.latest}`);
  });

  // ── 3. client_metrics_summary SEO columns ────────────────────────────────
  console.log('\n=== 3. SEO COLUMNS IN client_metrics_summary (Feb 2026) ===');
  const { data: sumFeb } = await sb.from('client_metrics_summary')
    .select('client_id,date,seo_impressions,seo_clicks,seo_ctr,sessions,top_keywords')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-01')
    .lte('date', '2026-02-28')
    .gt('seo_impressions', 0);
  const seoByClient: Record<string, { count: number; latest: string; maxImpr: number }> = {};
  for (const r of sumFeb || []) {
    if (!seoByClient[r.client_id]) seoByClient[r.client_id] = { count: 0, latest: r.date, maxImpr: 0 };
    seoByClient[r.client_id].count++;
    if (r.date > seoByClient[r.client_id].latest) seoByClient[r.client_id].latest = r.date;
    if ((r.seo_impressions || 0) > seoByClient[r.client_id].maxImpr) seoByClient[r.client_id].maxImpr = r.seo_impressions;
  }
  const noSeoSum = (clients || []).filter((c: any) => !seoByClient[c.id]);
  console.log(`  Clients with NO seo_impressions in summary: ${noSeoSum.length}`);
  noSeoSum.forEach((c: any) => console.log(`    - ${c.name}`));
  Object.entries(seoByClient).forEach(([cid, v]) => {
    console.log(`    ${nm.get(cid)?.padEnd(35)} days=${v.count}  latest=${v.latest}  maxImpr=${v.maxImpr}`);
  });

  // ── 4. Latest GSC date per client ─────────────────────────────────────────
  console.log('\n=== 4. LATEST GSC DATE PER CLIENT ===');
  const { data: latestGsc } = await sb.from('gsc_queries')
    .select('client_id,date')
    .gte('date', '2026-02-01')
    .order('date', { ascending: false });
  const latestByClient: Record<string, string> = {};
  for (const r of latestGsc || []) {
    if (!latestByClient[r.client_id]) latestByClient[r.client_id] = r.date;
  }
  (clients || []).forEach((c: any) => {
    const latest = latestByClient[c.id];
    const daysAgo = latest ? Math.round((Date.now() - new Date(latest).getTime()) / 86400000) : null;
    const flag = daysAgo === null ? '❌ NO DATA' : daysAgo > 5 ? `⚠️  ${daysAgo}d ago` : `✅ ${daysAgo}d ago`;
    console.log(`  ${c.name.padEnd(35)} latest=${latest || 'NONE'}  ${flag}`);
  });

  // ── 5. GA4 sessions coverage ──────────────────────────────────────────────
  console.log('\n=== 5. GA4 SESSIONS COVERAGE (Feb 2026) ===');
  let ga4All: any[] = [], ga4From = 0;
  while (true) {
    const { data } = await sb.from('ga4_sessions')
      .select('client_id,date,sessions')
      .gte('date', '2026-02-01')
      .lte('date', '2026-02-28')
      .range(ga4From, ga4From + 999);
    if (!data || data.length === 0) break;
    ga4All = ga4All.concat(data);
    if (data.length < 1000) break;
    ga4From += 1000;
  }
  const ga4ByClient: Record<string, { totalSessions: number; days: number; latest: string }> = {};
  for (const r of ga4All) {
    if (!ga4ByClient[r.client_id]) ga4ByClient[r.client_id] = { totalSessions: 0, days: 0, latest: r.date };
    ga4ByClient[r.client_id].totalSessions += r.sessions || 0;
    ga4ByClient[r.client_id].days++;
    if (r.date > ga4ByClient[r.client_id].latest) ga4ByClient[r.client_id].latest = r.date;
  }
  const noGa4 = (clients || []).filter((c: any) => !ga4ByClient[c.id]);
  console.log(`  Clients with NO GA4 sessions (Feb 2026): ${noGa4.length}`);
  noGa4.forEach((c: any) => console.log(`    - ${c.name}`));
  Object.entries(ga4ByClient).forEach(([cid, v]) => {
    console.log(`    ${nm.get(cid)?.padEnd(35)} sessions=${String(v.totalSessions).padStart(6)}  days=${v.days}  latest=${v.latest}`);
  });

  // ── 6. Cross-check: summary sessions vs ga4_sessions ─────────────────────
  console.log('\n=== 6. CROSS-CHECK: summary.sessions vs ga4_sessions (Feb 1-28) ===');
  const { data: sumSessions } = await sb.from('client_metrics_summary')
    .select('client_id,date,sessions')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-01')
    .lte('date', '2026-02-28');

  // Total sessions per client from summary
  const sumTotal: Record<string, number> = {};
  for (const r of sumSessions || []) {
    sumTotal[r.client_id] = (sumTotal[r.client_id] || 0) + (r.sessions || 0);
  }
  // Total sessions per client from ga4_sessions
  const ga4Total: Record<string, number> = {};
  for (const r of ga4All) {
    ga4Total[r.client_id] = (ga4Total[r.client_id] || 0) + (r.sessions || 0);
  }
  let mismatch = 0;
  (clients || []).forEach((c: any) => {
    const s = sumTotal[c.id] || 0;
    const g = ga4Total[c.id] || 0;
    const diff = Math.abs(s - g);
    const pct = g > 0 ? Math.round(diff / g * 100) : 0;
    if (diff > 10) {
      console.log(`  ⚠️  ${c.name.padEnd(35)} summary=${s}  ga4_raw=${g}  diff=${diff} (${pct}%)`);
      mismatch++;
    }
  });
  if (mismatch === 0) console.log('  ✅ All clients: summary sessions matches ga4_sessions (within 10)');

  // ── 7. CTR sanity check ───────────────────────────────────────────────────
  console.log('\n=== 7. CTR SANITY: seo_ctr values in summary ===');
  const { data: ctrRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,seo_ctr,seo_clicks,seo_impressions')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-01')
    .gt('seo_impressions', 0);
  let badCtr = 0;
  for (const r of ctrRows || []) {
    // CTR should be stored as percentage (0-100), or as decimal (0-1)?
    const computedCtr = r.seo_clicks / r.seo_impressions;
    const storedCtr = r.seo_ctr;
    // If stored as 0-100: storedCtr should ≈ computedCtr * 100
    // If stored as 0-1: storedCtr should ≈ computedCtr
    const asPercent = Math.abs(storedCtr - computedCtr * 100) < 1;
    const asDecimal = Math.abs(storedCtr - computedCtr) < 0.01;
    if (!asPercent && !asDecimal && badCtr < 5) {
      console.log(`  ⚠️  ${nm.get(r.client_id)} ${r.date}: clicks=${r.seo_clicks} impr=${r.seo_impressions} stored_ctr=${storedCtr} computed=${(computedCtr*100).toFixed(2)}%`);
      badCtr++;
    }
  }
  if (badCtr === 0) console.log('  ✅ CTR values look correct');

  // ── 8. Keyword data ───────────────────────────────────────────────────────
  console.log('\n=== 8. TOP KEYWORDS IN SUMMARY ===');
  const { data: kwRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,top_keywords')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-01')
    .not('top_keywords', 'is', null)
    .limit(3);
  if (!kwRows || kwRows.length === 0) {
    console.log('  ❌ NO top_keywords data in summary at all!');
  } else {
    console.log(`  Sample top_keywords format (${kwRows.length} rows):`);
    kwRows.forEach(r => console.log(`    ${nm.get(r.client_id)} ${r.date}: ${JSON.stringify(r.top_keywords).slice(0, 150)}`));
  }

  // ── 9. GSC page data ─────────────────────────────────────────────────────
  console.log('\n=== 9. GSC PAGES DATA ===');
  const { data: gscPages } = await sb.from('gsc_pages')
    .select('client_id,date,page,clicks,impressions')
    .gte('date', '2026-02-01')
    .order('impressions', { ascending: false })
    .limit(5);
  if (!gscPages || gscPages.length === 0) {
    console.log('  ❌ NO gsc_pages data for Feb 2026!');
  } else {
    console.log(`  Sample gsc_pages (top by impressions):`);
    gscPages.forEach(r => console.log(`    ${nm.get(r.client_id)} ${r.date} clicks=${r.clicks} impr=${r.impressions} ${r.page?.slice(0, 60)}`));
  }

  // ── 10. Summary: SEO data gaps ────────────────────────────────────────────
  console.log('\n=== 10. SEO DATA GAPS SUMMARY ===');
  console.log('  Checking all clients for missing SEO data in Feb 2026...');
  (clients || []).forEach((c: any) => {
    const issues = [];
    if (!gscByClient[c.id]) issues.push('no gsc_queries');
    if (!ga4ByClient[c.id]) issues.push('no ga4_sessions');
    if (!seoByClient[c.id]) issues.push('no seo_impressions in summary');
    if (!latestByClient[c.id]) issues.push('no recent GSC data');
    if (issues.length > 0) {
      console.log(`  ❌ ${c.name}: ${issues.join(', ')}`);
    }
  });

  console.log('\n========================================');
  console.log('DONE');
  console.log('========================================\n');
}
main().catch(console.error);
