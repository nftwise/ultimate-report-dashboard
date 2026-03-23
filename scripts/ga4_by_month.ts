import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get unique client_ids per month from ga4_sessions
  // Fetch in chunks by month to avoid timeout
  const months = [
    '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
    '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
    '2026-01','2026-02'
  ];

  // Also get client names
  const { data: clients } = await sb.from('clients').select('id, name').eq('is_active', true).order('name');
  const nameMap = new Map((clients||[]).map(c => [c.id, c.name]));

  console.log('Month    | Unique GA4 clients | Missing clients');
  console.log('-'.repeat(80));

  const allMissing = new Map<string, string[]>(); // month -> missing client names

  for (const ym of months) {
    const [year, month] = ym.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${ym}-01`, to = `${ym}-${String(lastDay).padStart(2,'0')}`;

    const { data } = await sb.from('ga4_sessions')
      .select('client_id')
      .gte('date', from).lte('date', to)
      .gt('sessions', 0);

    const uniqueClients = new Set((data||[]).map(r => r.client_id));
    const activeIds = new Set((clients||[]).map(c => c.id));
    const missing = [...activeIds].filter(id => !uniqueClients.has(id)).map(id => nameMap.get(id) || id);

    allMissing.set(ym, missing);

    const bar = '█'.repeat(uniqueClients.size) + '░'.repeat(Math.max(0, 18 - uniqueClients.size));
    const flag = missing.length > 5 ? ' ⚠️ ' : missing.length > 0 ? ' ℹ️ ' : ' ✅';
    console.log(`${ym}  | ${String(uniqueClients.size).padStart(2)}/18 [${bar}]${flag} | ${missing.slice(0,3).join(', ')}${missing.length > 3 ? ` +${missing.length-3} more` : ''}`);
  }

  // Clients consistently missing across many months
  console.log('\n--- Clients with GA4 gaps across 3+ months ---');
  const gapCount = new Map<string, number>();
  for (const [ym, missing] of allMissing) {
    for (const name of missing) gapCount.set(name, (gapCount.get(name)||0) + 1);
  }
  [...gapCount.entries()]
    .filter(([,n]) => n >= 3)
    .sort((a,b) => b[1]-a[1])
    .forEach(([name, n]) => console.log(`  ${name}: missing ${n}/14 months`));
}
main();
