import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clients } = await sb.from('clients')
    .select('id, service_configs(ga_property_id, gads_customer_id, gbp_location_id)')
    .eq('is_active', true);

  const withGA4 = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.ga_property_id?.trim());
  }).length;
  const withAds = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.gads_customer_id?.trim());
  }).length;

  console.log(`Active clients: ${clients?.length} | GA4:${withGA4} ADS:${withAds}\n`);

  // Fetch all data Jan 2025 - Feb 2026 in one shot per table
  const START = '2025-01-01', END = '2026-02-28';

  console.log('Fetching raw tables... (this may take a moment)');
  const fetchFull = async (table: string, col: string, extra?: (q: any) => any) => {
    let all: any[] = [], from = 0;
    while (true) {
      let q = sb.from(table).select(`client_id,date,${col}`)
        .gte('date', START).lte('date', END).range(from, from+999);
      if (extra) q = extra(q);
      const { data } = await q;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  };

  const [ga4All, adsAll, rollAll] = await Promise.all([
    fetchFull('ga4_sessions', 'sessions'),
    fetchFull('ads_campaign_metrics', 'cost'),
    fetchFull('client_metrics_summary', 'sessions,ad_spend', q => q.eq('period_type','daily')),
  ]);

  // Build per-date: # unique clients with value > 0
  const buildDayCount = (rows: any[], col: string) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      if (parseFloat(r[col]||0) > 0) {
        if (!m.has(r.date)) m.set(r.date, new Set());
        m.get(r.date)!.add(r.client_id);
      }
    }
    return m;
  };

  const ga4Map  = buildDayCount(ga4All, 'sessions');
  const adsMap  = buildDayCount(adsAll, 'cost');
  const rllSess = buildDayCount(rollAll, 'sessions');
  const rllSpend= buildDayCount(rollAll, 'ad_spend');

  // Aggregate by MONTH
  type MonthStats = {
    days: number; ga4Zero: number; ga4Low: number;
    adsZero: number; rllLow: number; rllSpendLow: number;
    worstGA4Day: string; worstGA4Count: number;
  };

  const months = new Map<string, MonthStats>();

  // Iterate every day
  const start = new Date('2025-01-01T12:00:00Z');
  const end   = new Date('2026-02-28T12:00:00Z');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split('T')[0];
    const ym   = date.slice(0, 7);
    if (!months.has(ym)) months.set(ym, { days:0, ga4Zero:0, ga4Low:0, adsZero:0, rllLow:0, rllSpendLow:0, worstGA4Day:'', worstGA4Count:withGA4 });

    const m = months.get(ym)!;
    m.days++;

    const ga4n  = ga4Map.get(date)?.size  || 0;
    const adsn  = adsMap.get(date)?.size  || 0;
    const rllSn = rllSess.get(date)?.size || 0;
    const rllSpn= rllSpend.get(date)?.size|| 0;

    if (ga4n === 0) m.ga4Zero++;
    else if (ga4n < withGA4 - 2) m.ga4Low++;
    if (adsn < withAds - 3) m.adsZero++;
    if (rllSn < ga4n - 3) m.rllLow++;
    if (rllSpn < adsn - 3) m.rllSpendLow++;
    if (ga4n < m.worstGA4Count) { m.worstGA4Count = ga4n; m.worstGA4Day = date; }
  }

  // Print monthly table
  console.log('\nMonth    | Days | GA4_zero_days | GA4_low_days | ADS_low | RLL_sess_low | RLL_spend_low | STATUS');
  console.log('-'.repeat(105));

  for (const [ym, m] of months) {
    const ga4Issues = m.ga4Zero + m.ga4Low;
    const hasIssue  = ga4Issues > 0 || m.adsZero > 5 || m.rllLow > 2 || m.rllSpendLow > 3;
    const status = m.ga4Zero > 10 ? '🚨 GA4 SAPPED' :
                   m.ga4Zero > 3  ? '⚠️  GA4 GAPS' :
                   ga4Issues > 5  ? '⚠️  GA4 LOW' :
                   m.rllSpendLow > 5 ? '⚠️  SPEND MISSING' :
                   hasIssue       ? '⚠️  minor' : '✅ OK';
    console.log(
      `${ym}  | ${String(m.days).padStart(2)}   | ${String(m.ga4Zero).padStart(5)} (${Math.round(m.ga4Zero/m.days*100)}%)      | ${String(m.ga4Low).padStart(4)} (${Math.round(m.ga4Low/m.days*100)}%)     | ${String(m.adsZero).padStart(3)}     | ${String(m.rllLow).padStart(4)}         | ${String(m.rllSpendLow).padStart(5)}         | ${status}` +
      (m.ga4Zero > 0 ? `  worst: ${m.worstGA4Day}(${m.worstGA4Count}/${withGA4})` : '')
    );
  }

  // Now show GA4 per-day detail for Feb 2026 (where we know there's an issue)
  console.log('\n--- GA4 per day Feb 2026 (clients with sessions > 0) ---');
  for (let d = 1; d <= 28; d++) {
    const date = `2026-02-${String(d).padStart(2,'0')}`;
    const n = ga4Map.get(date)?.size || 0;
    const bar = '█'.repeat(n) + '░'.repeat(Math.max(0, withGA4-n));
    const flag = n === 0 ? ' ← ZERO' : n < withGA4-3 ? ' ← LOW' : '';
    console.log(`  ${date}: ${String(n).padStart(2)}/${withGA4} [${bar}]${flag}`);
  }
}
main();
