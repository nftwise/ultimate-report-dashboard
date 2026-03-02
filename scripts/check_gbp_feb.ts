import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clt } = await sb.from('clients').select('id').eq('name','Chiropractic Care Centre').single();
  const cid = (clt as any)?.id;

  // Raw GBP for Feb 24-28
  const { data: raw } = await sb.from('gbp_location_daily_metrics')
    .select('date,phone_calls,views,website_clicks,direction_requests')
    .eq('client_id',cid).gte('date','2026-02-24').lte('date','2026-02-28').order('date');
  console.log('Raw GBP Feb 24-28:');
  raw?.forEach(r => console.log(`  ${r.date} calls=${r.phone_calls} views=${r.views} web=${r.website_clicks} dirs=${r.direction_requests}`));

  // Summary for Feb 24-28
  const { data: sum } = await sb.from('client_metrics_summary')
    .select('date,gbp_calls,gbp_profile_views,gbp_website_clicks,gbp_directions,updated_at')
    .eq('client_id',cid).eq('period_type','daily')
    .gte('date','2026-02-24').lte('date','2026-02-28').order('date');
  console.log('\nSummary GBP Feb 24-28:');
  sum?.forEach(r => console.log(`  ${r.date} calls=${r.gbp_calls} views=${r.gbp_profile_views} web=${r.gbp_website_clicks} dirs=${r.gbp_directions} updated=${r.updated_at?.split('T')[0]}`));

  // Check ALL clients for Feb 27 gbp_profile_views
  console.log('\nAll clients gbp_profile_views for Feb 28:');
  const { data: allFeb28 } = await sb.from('client_metrics_summary')
    .select('client_id,gbp_calls,gbp_profile_views,gbp_website_clicks,gbp_directions')
    .eq('period_type','daily').eq('date','2026-02-28');
  const { data: allClients } = await sb.from('clients').select('id,name');
  const nm = new Map((allClients||[]).map(c => [c.id, c.name]));
  allFeb28?.forEach(r => console.log(`  ${nm.get(r.client_id)||r.client_id}: calls=${r.gbp_calls} views=${r.gbp_profile_views} web=${r.gbp_website_clicks} dirs=${r.gbp_directions}`));

  // Also check raw GBP for ALL clients Feb 28
  console.log('\nRaw GBP Feb 28 (all clients):');
  const { data: rawAll } = await sb.from('gbp_location_daily_metrics')
    .select('client_id,phone_calls,views,website_clicks,direction_requests').eq('date','2026-02-28');
  rawAll?.forEach(r => console.log(`  ${nm.get(r.client_id)||r.client_id}: calls=${r.phone_calls} views=${r.views} web=${r.website_clicks} dirs=${r.direction_requests}`));
}
main().catch(console.error);
