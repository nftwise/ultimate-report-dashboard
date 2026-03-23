import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fetchAllPaginated(table: string, select: string, filters: (q: any) => any) {
  let all: any[] = [], from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + 999);
    q = filters(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  const { data: clients } = await sb.from('clients').select('id, name').eq('is_active', true).order('name');
  const nameMap = new Map((clients||[]).map(c => [c.id, c.name]));
  const total = clients?.length || 0;

  const months = [
    '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
    '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
    '2026-01','2026-02',
  ];

  console.log('Month    | GA4 clients | Missing clients');
  console.log('-'.repeat(100));

  const gapCount = new Map<string, number>();

  for (const ym of months) {
    const [year, month] = ym.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${ym}-01`, to = `${ym}-${String(lastDay).padStart(2,'0')}`;

    const rows = await fetchAllPaginated('ga4_sessions', 'client_id', q =>
      q.gte('date', from).lte('date', to).gt('sessions', 0)
    );

    const uniqueClients = new Set(rows.map(r => r.client_id));
    const activeIds = new Set((clients||[]).map(c => c.id));
    const missing = [...activeIds].filter(id => !uniqueClients.has(id)).map(id => nameMap.get(id) || id);

    missing.forEach(name => gapCount.set(name, (gapCount.get(name)||0) + 1));

    const n = uniqueClients.size;
    const bar = '█'.repeat(n) + '░'.repeat(Math.max(0, total - n));
    const flag = missing.length === 0 ? ' ✅' : missing.length <= 4 ? ' ℹ️ ' : ' ⚠️ ';
    console.log(`${ym}  | ${String(n).padStart(2)}/${total} [${bar}]${flag} | ${missing.slice(0,4).join(', ')}${missing.length > 4 ? ` +${missing.length-4} more` : ''}`);
  }

  console.log('\n--- Clients missing from 3+ months (late onboarding or gaps) ---');
  [...gapCount.entries()]
    .sort((a,b) => b[1]-a[1])
    .forEach(([name, n]) => console.log(`  ${name}: missing ${n}/14 months`));

  console.log('\n✅ NOTE: This audit uses paginated queries (no 1000-row cap per month).');
}
main();
