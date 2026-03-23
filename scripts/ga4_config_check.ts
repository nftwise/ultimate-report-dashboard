import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get all active clients with their GA4 config
  const { data: clients } = await sb.from('clients')
    .select('id, name, service_configs(ga_property_id)')
    .eq('is_active', true).order('name');

  // Get unique client_ids that have ANY ga4_sessions data
  const { data: ga4Rows } = await sb.from('ga4_sessions')
    .select('client_id')
    .gte('date', '2025-01-01').lte('date', '2026-02-28')
    .gt('sessions', 0);

  const hasGA4Data = new Set((ga4Rows || []).map(r => r.client_id));

  console.log(`\nActive clients: ${clients?.length} | Clients with ANY GA4 data (Jan 2025-Feb 2026): ${hasGA4Data.size}`);
  console.log('\nClient Name                          | ga_property_id          | Has GA4 Data');
  console.log('-'.repeat(90));

  let withPropId = 0, withData = 0, withPropButNoData = 0, withDataButNoProp = 0;

  for (const c of clients || []) {
    const cfg: any = Array.isArray(c.service_configs) ? c.service_configs[0] || {} : c.service_configs || {};
    const propId = cfg.ga_property_id?.trim() || '';
    const hasData = hasGA4Data.has(c.id);
    if (propId) withPropId++;
    if (hasData) withData++;
    if (propId && !hasData) withPropButNoData++;
    if (!propId && hasData) withDataButNoProp++;

    const propDisplay = propId || '(none)';
    const dataFlag = hasData ? '✅ YES' : '❌ NO';
    const issue = propId && !hasData ? ' ← HAS PROP ID BUT NO DATA!' : (!propId && !hasData ? ' ← no config' : '');
    console.log(`${c.name.padEnd(36)} | ${propDisplay.padEnd(23)} | ${dataFlag}${issue}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  Has ga_property_id configured: ${withPropId}/18`);
  console.log(`  Has actual GA4 data in DB:     ${withData}/18`);
  console.log(`  Has prop ID but NO data:       ${withPropButNoData} ← needs backfill`);
  console.log(`  Has data but no prop ID:       ${withDataButNoProp} ← orphaned data`);
  console.log(`  Missing both (no config):      ${(clients?.length || 0) - withPropId - withDataButNoProp}`);
}
main();
