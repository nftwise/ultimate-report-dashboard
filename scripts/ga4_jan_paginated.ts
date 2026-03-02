import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Count total rows for Jan 2025
  const { count: janTotal } = await sb.from('ga4_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2025-01-01').lte('date', '2025-01-31').gt('sessions', 0);
  console.log(`Total rows in ga4_sessions for Jan 2025: ${janTotal}`);
  console.log(`(if >1000, the unpaginated ga4_by_month.ts was missing clients)`);

  // Count unique clients using paginated approach
  let all: any[] = [], from = 0;
  while (true) {
    const { data } = await sb.from('ga4_sessions')
      .select('client_id').gte('date', '2025-01-01').lte('date', '2025-01-31')
      .gt('sessions', 0).range(from, from + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const uniqueClients = new Set(all.map(r => r.client_id));
  console.log(`\nUnique clients in Jan 2025 (paginated properly): ${uniqueClients.size}/18`);

  // Also check which clients DO have Jan 2025 data
  const { data: clients } = await sb.from('clients').select('id, name').eq('is_active', true).order('name');
  const nameMap = new Map((clients||[]).map(c => [c.id, c.name]));
  const missing = (clients||[]).filter(c => !uniqueClients.has(c.id)).map(c => c.name);
  console.log(`Missing clients (Jan 2025): ${missing.length > 0 ? missing.join(', ') : 'NONE — all present!'}`);
}
main();
