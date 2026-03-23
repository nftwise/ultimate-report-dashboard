import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // When were GBP rows last updated?
  const { data: recent } = await sb.from('gbp_location_daily_metrics')
    .select('date,updated_at,phone_calls,views')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('\nLast 10 GBP sync updates:');
  recent?.forEach((r: any) => console.log(`  data_date=${r.date}  synced=${r.updated_at?.slice(0,19)}  views=${r.views}  calls=${r.phone_calls}`));

  // Check specifically Feb 22-28 — are those rows getting synced?
  const { data: lagRows } = await sb.from('gbp_location_daily_metrics')
    .select('date,updated_at,phone_calls,views,client_id')
    .gte('date', '2026-02-22')
    .lte('date', '2026-02-28')
    .order('date', { ascending: true })
    .limit(20);

  console.log('\nFeb 22-28 rows (first 20):');
  const { data: clients } = await sb.from('clients').select('id,name');
  const nm = new Map((clients || []).map((c: any) => [c.id, c.name]));
  lagRows?.forEach((r: any) => console.log(`  ${r.date}  client=${nm.get(r.client_id)?.slice(0,20).padEnd(20)}  views=${r.views}  calls=${r.phone_calls}  synced=${r.updated_at?.slice(0,10)}`));
}
main().catch(console.error);
