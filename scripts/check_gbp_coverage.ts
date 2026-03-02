import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await sb.from('gbp_location_daily_metrics')
    .select('client_id,date,phone_calls,views,website_clicks,direction_requests')
    .gte('date', '2026-02-15')
    .order('date', { ascending: false });

  const { data: clients } = await sb.from('clients').select('id,name');
  const nm = new Map((clients || []).map((c: any) => [c.id, c.name]));

  // Group by date
  const byDate: Record<string, { clients: number; nonZero: number }> = {};
  for (const r of data || []) {
    if (!byDate[r.date]) byDate[r.date] = { clients: 0, nonZero: 0 };
    byDate[r.date].clients++;
    if (r.phone_calls > 0 || r.views > 0 || r.website_clicks > 0) byDate[r.date].nonZero++;
  }

  console.log('\nGBP raw data coverage by date (Feb 15+):');
  Object.keys(byDate).sort().forEach(d => {
    const b = byDate[d];
    console.log(`  ${d}: ${b.clients} clients, ${b.nonZero} with non-zero data`);
  });

  // Also check client_metrics_summary gbp columns
  console.log('\nGBP in client_metrics_summary (Feb 20-28):');
  const { data: sum } = await sb.from('client_metrics_summary')
    .select('date,client_id,gbp_profile_views,gbp_calls,gbp_website_clicks,gbp_directions')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-20')
    .lte('date', '2026-02-28')
    .gt('gbp_profile_views', 0)
    .order('date', { ascending: false });

  const byDate2: Record<string, number> = {};
  for (const r of sum || []) {
    byDate2[r.date] = (byDate2[r.date] || 0) + 1;
  }
  Object.keys(byDate2).sort().forEach(d => {
    console.log(`  ${d}: ${byDate2[d]} clients with gbp_profile_views > 0`);
  });
}
main().catch(console.error);
