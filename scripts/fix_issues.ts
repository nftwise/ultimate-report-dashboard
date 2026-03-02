import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('\n🔧 Fixing database issues found in accuracy test\n');

  // ── 1. Find and fix impossible CTR rows (clicks > impressions) ────────────
  console.log('=== 1. Fixing impossible CTR rows ===');
  const { data: badRows } = await sb.from('ads_campaign_metrics')
    .select('id,client_id,date,campaign_name,clicks,impressions,cost')
    .gte('date','2025-01-01').lte('date','2026-02-28');
  const impossible = (badRows||[]).filter(r => r.clicks > r.impressions);
  console.log(`Found ${impossible.length} rows with clicks > impressions`);

  for (const row of impossible) {
    const { data: clients } = await sb.from('clients').select('name').eq('id',row.client_id).single();
    console.log(`  ${row.date} | ${(clients as any)?.name} | "${row.campaign_name}" | clicks=${row.clicks} → capping to impressions=${row.impressions}`);
    const { error } = await sb.from('ads_campaign_metrics')
      .update({ clicks: row.impressions })
      .eq('id', row.id);
    if (error) console.log(`  ❌ Error: ${error.message}`);
    else console.log(`  ✅ Fixed`);
  }
  if (impossible.length === 0) console.log('  ✅ No impossible CTR rows found');

  // ── 2. Deactivate GBP orphans (inactive clients still active in gbp_locations) ──
  console.log('\n=== 2. Deactivating GBP orphan entries ===');
  const { data: gbpLocs } = await sb.from('gbp_locations').select('client_id,location_name,is_active');
  const { data: allClients } = await sb.from('clients').select('id,name,is_active');
  const clientMap = new Map((allClients||[]).map(c => [c.id, c]));

  const orphans = (gbpLocs||[]).filter(loc => {
    const c = clientMap.get(loc.client_id);
    return loc.is_active && c && !c.is_active; // gbp_locations active but client is inactive
  });

  console.log(`Found ${orphans.length} GBP orphan entries (inactive clients with active GBP locations)`);
  for (const orphan of orphans) {
    const c = clientMap.get(orphan.client_id);
    console.log(`  Deactivating: ${c?.name} | location: ${orphan.location_name}`);
    const { error } = await sb.from('gbp_locations')
      .update({ is_active: false })
      .eq('client_id', orphan.client_id);
    if (error) console.log(`  ❌ Error: ${error.message}`);
    else console.log(`  ✅ Deactivated`);
  }
  if (orphans.length === 0) console.log('  ✅ No orphan entries found');

  // ── 3. Verify fixes ───────────────────────────────────────────────────────
  console.log('\n=== 3. Verification ===');

  // Verify CTR fix
  const { data: verifyRows } = await sb.from('ads_campaign_metrics')
    .select('client_id,date,clicks,impressions')
    .gte('date','2025-01-01').lte('date','2026-02-28')
    .gt('impressions',0);
  const stillBad = (verifyRows||[]).filter(r => r.clicks > r.impressions);
  if (stillBad.length === 0) console.log('  ✅ CTR sanity: all rows now have clicks ≤ impressions');
  else console.log(`  ❌ Still ${stillBad.length} rows with clicks > impressions`);

  // Verify GBP orphan fix
  const { data: verifyGBP } = await sb.from('gbp_locations').select('client_id,is_active');
  const { data: inactiveClients } = await sb.from('clients').select('id').eq('is_active',false);
  const inactiveSet = new Set((inactiveClients||[]).map(c => c.id));
  const stillOrphans = (verifyGBP||[]).filter(l => l.is_active && inactiveSet.has(l.client_id));
  if (stillOrphans.length === 0) console.log('  ✅ GBP orphans: all cleared');
  else console.log(`  ❌ Still ${stillOrphans.length} orphan entries`);

  console.log('\nDone.\n');
}
main().catch(console.error);
