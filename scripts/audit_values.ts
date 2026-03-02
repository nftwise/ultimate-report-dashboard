import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // How many summary rows per date, and how many have sessions > 0
  const dates = ['2026-02-25','2026-02-26','2026-02-27','2026-02-28'];
  console.log('Date         | Total rows | sessions>0 | ad_spend>0 | leads>0');
  console.log('-'.repeat(65));
  for (const date of dates) {
    const { data } = await sb.from('client_metrics_summary')
      .select('sessions, total_leads, ad_spend')
      .eq('date', date).eq('period_type','daily');
    const rows      = data?.length || 0;
    const hasSess   = (data || []).filter(r => (r.sessions||0) > 0).length;
    const hasSpend  = (data || []).filter(r => (r.ad_spend||0) > 0).length;
    const hasLeads  = (data || []).filter(r => (r.total_leads||0) > 0).length;
    console.log(`${date}  |     ${String(rows).padStart(2)}     |     ${String(hasSess).padStart(2)}     |     ${String(hasSpend).padStart(2)}     |   ${String(hasLeads).padStart(2)}`);
  }

  // Also check ads raw data for Feb 27 and 28
  console.log('\nAds raw spend by date:');
  for (const date of ['2026-02-27','2026-02-28']) {
    const { data } = await sb.from('ads_campaign_metrics').select('cost').eq('date', date);
    const total = (data||[]).reduce((s,r) => s + parseFloat(r.cost||0), 0);
    console.log(`  ${date}: total cost = $${total.toFixed(2)} across ${data?.length||0} campaign rows`);
  }
}
main();
