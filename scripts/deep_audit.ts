import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get active clients + their configs
  const { data: clients } = await sb.from('clients')
    .select('id, name, service_configs(ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id)')
    .eq('is_active', true).order('name');

  const total = clients?.length || 0;
  const withGA4 = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.ga_property_id?.trim());
  }).length;
  const withAds = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.gads_customer_id?.trim());
  }).length;
  const withGBP = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.gbp_location_id?.trim());
  }).length;
  const withGSC = (clients||[]).filter(c => {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0]||{} : c.service_configs||{};
    return Boolean(cfg.gsc_site_url?.trim());
  }).length;

  console.log(`Active clients: ${total} | GA4:${withGA4} ADS:${withAds} GBP:${withGBP} GSC:${withGSC}\n`);

  // Fetch ALL raw data for Feb 2026 in bulk
  const [ga4All, adsAll, gbpAll, gscAll, rollupAll] = await Promise.all([
    sb.from('ga4_sessions').select('client_id,date,sessions')
      .gte('date','2026-02-01').lte('date','2026-02-28').then(r => r.data||[]),
    sb.from('ads_campaign_metrics').select('client_id,date,cost')
      .gte('date','2026-02-01').lte('date','2026-02-28').then(r => r.data||[]),
    sb.from('gbp_location_daily_metrics').select('client_id,date,views,phone_calls')
      .gte('date','2026-02-01').lte('date','2026-02-28').then(r => r.data||[]),
    sb.from('gsc_daily_summary').select('client_id,date,total_clicks')
      .gte('date','2026-02-01').lte('date','2026-02-28').then(r => r.data||[]),
    sb.from('client_metrics_summary').select('client_id,date,sessions,ad_spend,total_leads')
      .eq('period_type','daily').gte('date','2026-02-01').lte('date','2026-02-28').then(r => r.data||[]),
  ]);

  // Build per-date maps: date → Set of client_ids with actual data (value > 0)
  type DMap = Map<string, Set<string>>;
  const buildMap = (rows: any[], valueKey: string): DMap => {
    const m: DMap = new Map();
    for (const r of rows) {
      const val = parseFloat(r[valueKey]||0);
      if (val > 0) {
        if (!m.has(r.date)) m.set(r.date, new Set());
        m.get(r.date)!.add(r.client_id);
      }
    }
    return m;
  };

  // Also: clients that HAVE rows (even if 0) per date
  const buildExistsMap = (rows: any[]): DMap => {
    const m: DMap = new Map();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, new Set());
      m.get(r.date)!.add(r.client_id);
    }
    return m;
  };

  const ga4ValMap   = buildMap(ga4All, 'sessions');
  const ga4ExMap    = buildExistsMap(ga4All);
  const adsValMap   = buildMap(adsAll, 'cost');
  const gbpValMap   = buildMap(gbpAll, 'views');
  const gbpExMap    = buildExistsMap(gbpAll);
  const gscValMap   = buildMap(gscAll, 'total_clicks');
  const rollupExMap = buildExistsMap(rollupAll);
  const rollupValMap= buildMap(rollupAll, 'sessions');
  const rollupSpend = buildMap(rollupAll, 'ad_spend');

  // Per-day summary
  console.log('Date       | GA4(rows/val) | ADS(rows/val) | GBP(rows/val) | GSC(val) | RLL(rows/sess/spend) | FLAGS');
  console.log('-'.repeat(120));

  const flags: string[] = [];

  for (let d = 1; d <= 28; d++) {
    const date = `2026-02-${String(d).padStart(2,'0')}`;
    const dow  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date+'T12:00:00Z').getDay()];

    const ga4ex  = ga4ExMap.get(date)?.size  || 0;
    const ga4val = ga4ValMap.get(date)?.size  || 0;
    const adsval = adsValMap.get(date)?.size  || 0;
    const gbpex  = gbpExMap.get(date)?.size   || 0;
    const gbpval = gbpValMap.get(date)?.size  || 0;
    const gscval = gscValMap.get(date)?.size  || 0;
    const rllEx  = rollupExMap.get(date)?.size || 0;
    const rllSes = rollupValMap.get(date)?.size || 0;
    const rllSp  = rollupSpend.get(date)?.size  || 0;

    const f: string[] = [];
    if (ga4ex < withGA4 - 2) f.push(`GA4_MISSING(${ga4ex}/${withGA4})`);
    else if (ga4val < ga4ex - 2) f.push(`GA4_ZEROS(val=${ga4val}/${ga4ex})`);
    if (adsval < withAds - 3 && dow !== 'Sun') f.push(`ADS_LOW(${adsval}/${withAds})`);
    if (rllEx < total - 1) f.push(`ROLLUP_MISSING(${rllEx}/${total})`);
    else if (rllSes < ga4val - 3) f.push(`ROLLUP_SESS_LOW(${rllSes}vs${ga4val})`);
    if (rllSp < adsval - 3) f.push(`ROLLUP_SPEND_LOW(${rllSp}vs${adsval})`);

    const flag = f.length ? '⚠  ' + f.join(' | ') : '✓';
    if (f.length) flags.push(`${date}(${dow}): ${f.join(', ')}`);

    console.log(
      `${date}(${dow}) | ${String(ga4ex).padStart(2)}/${String(ga4val).padStart(2)}       | ${String(adsval).padStart(2)}/${String(withAds).padStart(2)}         | ${String(gbpex).padStart(2)}/${String(gbpval).padStart(2)}         | ${String(gscval).padStart(2)}/${String(withGSC).padStart(2)}    | ${String(rllEx).padStart(2)}/${String(rllSes).padStart(2)}/${String(rllSp).padStart(2)}             | ${flag}`
    );
  }

  console.log('\n=== SUMMARY OF ISSUES ===');
  if (flags.length === 0) console.log('No issues found.');
  else flags.forEach(f => console.log(' ⚠  ' + f));
}
main();
