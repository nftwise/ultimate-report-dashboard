import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Latest date in each raw table (across all clients)
  const [ga4, gsc, ads, gbp] = await Promise.all([
    sb.from('ga4_sessions').select('date').order('date', { ascending: false }).limit(1),
    sb.from('gsc_daily_summary').select('date').order('date', { ascending: false }).limit(1),
    sb.from('ads_campaign_metrics').select('date').order('date', { ascending: false }).limit(1),
    sb.from('gbp_location_daily_metrics').select('date').order('date', { ascending: false }).limit(1),
  ]);
  console.log('Latest dates in raw tables:');
  console.log('  GA4:', ga4.data?.[0]?.date);
  console.log('  GSC:', gsc.data?.[0]?.date);
  console.log('  ADS:', ads.data?.[0]?.date);
  console.log('  GBP:', gbp.data?.[0]?.date);

  // Check how many GSC rows exist in last 7 days
  const { count } = await sb.from('gsc_daily_summary').select('*', { count: 'exact', head: true })
    .gte('date', '2026-02-21').lte('date', '2026-02-27');
  console.log('\ngsc_daily_summary rows Feb 21-27:', count);

  // Check per-date count
  const { data: perDate } = await sb.from('gsc_daily_summary').select('date')
    .gte('date', '2026-02-20').order('date', { ascending: false });
  const byDate: Record<string, number> = {};
  for (const r of perDate || []) byDate[r.date] = (byDate[r.date] || 0) + 1;
  console.log('GSC rows per date:', byDate);
}
main();
