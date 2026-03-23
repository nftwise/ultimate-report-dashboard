import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('\n=== Finding ALL rows where clicks > impressions (paginated) ===');

  // Fetch all rows paginated
  let all: any[] = [], from = 0;
  while (true) {
    const { data } = await sb.from('ads_campaign_metrics')
      .select('id,client_id,date,campaign_name,clicks,impressions')
      .gte('date','2024-01-01').lte('date','2026-12-31')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`  Total rows scanned: ${all.length}`);

  const bad = all.filter(r => r.clicks > r.impressions);
  console.log(`  Rows with clicks > impressions: ${bad.length}`);

  const { data: clients } = await sb.from('clients').select('id,name');
  const nm = new Map((clients||[]).map(c => [c.id, c.name]));

  let fixed = 0;
  for (const row of bad) {
    console.log(`  ${row.date} | ${nm.get(row.client_id)||row.client_id} | "${row.campaign_name}" | clicks=${row.clicks} impressions=${row.impressions} → capping clicks to ${row.impressions}`);
    const { error } = await sb.from('ads_campaign_metrics')
      .update({ clicks: row.impressions })
      .eq('id', row.id);
    if (error) console.log(`    ❌ ${error.message}`);
    else { console.log(`    ✅ Fixed`); fixed++; }
  }

  console.log(`\n  Fixed: ${fixed}/${bad.length} rows`);

  // Final verify
  let verify: any[] = [], from2 = 0;
  while (true) {
    const { data } = await sb.from('ads_campaign_metrics')
      .select('id,clicks,impressions')
      .gte('date','2024-01-01').range(from2, from2+999);
    if (!data || data.length === 0) break;
    verify = verify.concat(data);
    if (data.length < 1000) break;
    from2 += 1000;
  }
  const stillBad = verify.filter(r => r.clicks > r.impressions);
  if (stillBad.length === 0) console.log('\n  ✅ VERIFIED: All rows now have clicks ≤ impressions');
  else console.log(`\n  ❌ Still ${stillBad.length} bad rows remaining`);
}
main().catch(console.error);
