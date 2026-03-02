import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clients } = await sb.from('clients')
    .select('id, name').eq('is_active', true).order('name');

  console.log('Client Name                          | Total rows | Sessions>0 rows | Earliest date | Latest date');
  console.log('-'.repeat(105));

  for (const c of clients || []) {
    // Count total rows
    const { count: total } = await sb.from('ga4_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', c.id);

    // Count sessions > 0
    const { count: withSess } = await sb.from('ga4_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', c.id).gt('sessions', 0);

    // Get date range
    const { data: earliest } = await sb.from('ga4_sessions')
      .select('date').eq('client_id', c.id).order('date', { ascending: true }).limit(1);
    const { data: latest } = await sb.from('ga4_sessions')
      .select('date').eq('client_id', c.id).order('date', { ascending: false }).limit(1);

    const flag = (total || 0) === 0 ? ' ← NO DATA' : (withSess || 0) < 30 ? ' ← very sparse' : '';
    console.log(
      `${c.name.padEnd(36)} | ${String(total||0).padStart(8)}   | ${String(withSess||0).padStart(12)}    | ${earliest?.[0]?.date || '(none)'.padEnd(10)} | ${latest?.[0]?.date || '(none)'}${flag}`
    );
  }

  // Also total rows in the table
  const { count: grandTotal } = await sb.from('ga4_sessions')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal rows in ga4_sessions table: ${grandTotal}`);
}
main();
