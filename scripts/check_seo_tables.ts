import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // 1. gsc_daily_summary total rows
  const { count: dsc } = await sb.from('gsc_daily_summary').select('*', { count: 'exact', head: true });
  console.log('gsc_daily_summary total rows:', dsc);

  // 2. gsc_pages total rows
  const { count: pgc } = await sb.from('gsc_pages').select('*', { count: 'exact', head: true });
  console.log('gsc_pages total rows:', pgc);

  // 3. Sample top_keywords values in client_metrics_summary
  const { data: tkRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,top_keywords')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-25')
    .limit(5);
  console.log('\ntop_keywords samples:');
  tkRows?.forEach(r => console.log(`  ${r.date}: ${JSON.stringify(r.top_keywords)}`));

  // 4. Check gsc_daily_summary for any rows at all
  const { data: gscSample } = await sb.from('gsc_daily_summary').select('*').limit(3);
  console.log('\ngsc_daily_summary sample rows:', JSON.stringify(gscSample));

  // 5. Orphan client_ids in gsc_queries
  const { data: gscClients } = await sb.from('gsc_queries').select('client_id').gte('date', '2026-02-01').limit(2000);
  const { data: allClients } = await sb.from('clients').select('id,name');
  const clientMap = new Map((allClients || []).map((c: any) => [c.id, c.name]));
  const orphanIds = new Set<string>();
  for (const r of gscClients || []) {
    if (!clientMap.has(r.client_id)) orphanIds.add(r.client_id);
  }
  console.log('\nOrphan client_ids in gsc_queries (not in clients table):', [...orphanIds]);

  // 6. Check the "undefined" client in deep_seo_check
  // Try to find it in service_configs
  for (const oid of orphanIds) {
    const { data: sc } = await sb.from('service_configs').select('client_id,gsc_site_url').eq('client_id', oid).limit(1);
    const { data: cl } = await sb.from('clients').select('id,name,is_active').eq('id', oid).limit(1);
    console.log(`  ${oid}: clients=${JSON.stringify(cl)} service_configs=${JSON.stringify(sc)}`);
  }

  // 7. Check the SEO sync cron — does it write to gsc_daily_summary?
  // Verify by checking if today's date has any rows
  const { data: todayRows } = await sb.from('gsc_daily_summary').select('*').eq('date', '2026-03-01');
  console.log('\ngsc_daily_summary rows for 2026-03-01:', todayRows?.length ?? 0);

  // 8. Check rollup — how does it get seo_impressions if gsc_daily_summary is empty?
  const { data: rollupSample } = await sb.from('client_metrics_summary')
    .select('client_id,date,seo_impressions,seo_clicks,top_keywords')
    .eq('period_type', 'daily')
    .eq('date', '2026-02-26')
    .gt('seo_impressions', 0)
    .limit(3);
  console.log('\nSample rollup SEO row:', JSON.stringify(rollupSample?.[0]));
}
main().catch(console.error);
