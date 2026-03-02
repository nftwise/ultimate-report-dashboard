import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clients } = await sb.from('clients').select('id,name').eq('is_active', true);
  const nm = new Map((clients || []).map((c: any) => [c.id, c.name]));

  // 1. Latest date in gsc_daily_summary per client
  console.log('\n=== gsc_daily_summary latest date per client ===');
  const { data: gscLatest } = await sb.from('gsc_daily_summary')
    .select('client_id,date,top_keywords_count,total_impressions')
    .gte('date', '2026-02-20')
    .order('date', { ascending: false });

  const gscLatestByClient: Record<string, { date: string; count: number }> = {};
  for (const r of gscLatest || []) {
    if (!gscLatestByClient[r.client_id]) {
      gscLatestByClient[r.client_id] = { date: r.date, count: r.top_keywords_count };
    }
  }
  (clients || []).forEach((c: any) => {
    const v = gscLatestByClient[c.id];
    const flag = !v ? '❌ NO DATA' : v.date >= '2026-02-26' ? `✅ ${v.date}` : `⚠️  ${v.date}`;
    console.log(`  ${c.name.padEnd(35)} ${flag}  top_kw=${v?.count ?? '-'}`);
  });

  // 2. What dates does sync-gsc cover? — check if it also has single-day lag issue
  console.log('\n=== gsc_daily_summary date coverage (Feb 20-28) ===');
  const byDate: Record<string, number> = {};
  for (const r of gscLatest || []) {
    byDate[r.date] = (byDate[r.date] || 0) + 1;
  }
  Object.keys(byDate).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d]} clients`);
  });

  // 3. Why is top_keywords = 0 in rollup for Feb 27-28?
  console.log('\n=== Rollup top_keywords for Feb 24-28 ===');
  const { data: rollupKw } = await sb.from('client_metrics_summary')
    .select('client_id,date,top_keywords,seo_impressions')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-24')
    .lte('date', '2026-02-28')
    .order('date');

  const rollupByDate: Record<string, { zeros: number; nonzero: number }> = {};
  for (const r of rollupKw || []) {
    if (!rollupByDate[r.date]) rollupByDate[r.date] = { zeros: 0, nonzero: 0 };
    if (!r.top_keywords || r.top_keywords === 0) rollupByDate[r.date].zeros++;
    else rollupByDate[r.date].nonzero++;
  }
  Object.keys(rollupByDate).sort().forEach(d => {
    const v = rollupByDate[d];
    const flag = v.zeros === 0 ? '✅' : v.nonzero === 0 ? '❌ ALL ZERO' : '⚠️ PARTIAL';
    console.log(`  ${d}: nonzero=${v.nonzero} zeros=${v.zeros} ${flag}`);
  });

  // 4. Check gsc_queries latest date per client (GSC lag)
  console.log('\n=== gsc_queries latest date per client ===');
  const { data: qLatest } = await sb.from('gsc_queries')
    .select('client_id,date')
    .gte('date', '2026-02-20')
    .order('date', { ascending: false });

  const qLatestByClient: Record<string, string> = {};
  for (const r of qLatest || []) {
    if (!qLatestByClient[r.client_id]) qLatestByClient[r.client_id] = r.date;
  }
  (clients || []).forEach((c: any) => {
    const d = qLatestByClient[c.id];
    const daysAgo = d ? Math.round((Date.now() - new Date(d + 'T12:00:00Z').getTime()) / 86400000) : null;
    const flag = daysAgo === null ? '❌ NO GSC' : daysAgo <= 4 ? `✅ ${d} (${daysAgo}d ago)` : `⚠️  ${d} (${daysAgo}d ago)`;
    console.log(`  ${c.name.padEnd(35)} ${flag}`);
  });

  // 5. Does sync-gsc suffer same single-day window bug as sync-gbp did?
  console.log('\n=== sync-gsc: does it also only sync yesterday? ===');
  // Check if gsc_daily_summary has consecutive dates or gaps
  const { data: allDates } = await sb.from('gsc_daily_summary')
    .select('date')
    .gte('date', '2026-02-01')
    .order('date', { ascending: false });
  const uniqueDates = [...new Set((allDates || []).map((r: any) => r.date))].sort();
  console.log(`  Dates in gsc_daily_summary (Feb+): ${uniqueDates.slice(-10).join(', ')}`);
  console.log(`  Latest date: ${uniqueDates[uniqueDates.length - 1]}`);
  console.log(`  Total unique dates: ${uniqueDates.length}`);

  // 6. Check gsc_pages table existence and structure
  console.log('\n=== gsc_pages table ===');
  const { data: gscPagesSchema, error: gscPagesErr } = await sb.from('gsc_pages').select('*').limit(1);
  if (gscPagesErr) console.log('  Error:', gscPagesErr.message);
  else if (!gscPagesSchema || gscPagesSchema.length === 0) console.log('  Table exists but is EMPTY');
  else console.log('  Columns:', Object.keys(gscPagesSchema[0]).join(', '));

  // 7. Traffic source data in summary — is it always 0?
  console.log('\n=== traffic_organic / traffic_direct in summary (Feb 2026) ===');
  const { data: trafficRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,traffic_organic,traffic_direct,traffic_paid,traffic_referral')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-01')
    .gt('traffic_organic', 0)
    .limit(5);
  if (!trafficRows || trafficRows.length === 0) {
    console.log('  ❌ traffic_organic = 0 for ALL rows in Feb 2026 — this metric is broken');
  } else {
    trafficRows.forEach(r => console.log(`  ${r.date} ${nm.get(r.client_id)}: organic=${r.traffic_organic} direct=${r.traffic_direct}`));
  }

  // 8. GA4 source_medium breakdown (what CAN we use for traffic sources?)
  console.log('\n=== GA4 source_medium data (Feb 2026, top sources) ===');
  const { data: sm } = await sb.from('ga4_sessions')
    .select('source_medium,sessions')
    .gte('date', '2026-02-01')
    .lte('date', '2026-02-28')
    .order('sessions', { ascending: false })
    .limit(20);
  const smAgg: Record<string, number> = {};
  for (const r of sm || []) {
    if (!r.source_medium) continue;
    smAgg[r.source_medium] = (smAgg[r.source_medium] || 0) + (r.sessions || 0);
  }
  Object.entries(smAgg).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => {
    console.log(`  ${v.toString().padStart(5)} sessions: ${k}`);
  });
}
main().catch(console.error);
