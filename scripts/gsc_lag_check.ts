import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await sb.from('gsc_daily_summary').select('date').order('date', { ascending: false }).limit(20);
  const dates = [...new Set((data||[]).map((r: any) => r.date))];
  console.log('Latest GSC daily summary dates:', dates.slice(0, 7));
  // Count per recent date
  for (const d of dates.slice(0, 5)) {
    const { count } = await sb.from('gsc_daily_summary').select('*', { count: 'exact', head: true }).eq('date', d);
    console.log(`  ${d}: ${count} clients`);
  }
}
main();
