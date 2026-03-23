import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function main() {
  const env = fs.readFileSync('/Users/imac2017/Desktop/ultimate-report-dashboard/.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?/)?.[1]?.trim() as string;
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="?([^"\n]+)"?/)?.[1]?.trim() as string;

  if (!url || !key) { console.error('Could not parse env vars'); process.exit(1); }

  const supabase = createClient(url, key);

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, slug')
    .eq('is_active', true);

  const { data: gbpLocs } = await supabase
    .from('gbp_locations')
    .select('client_id')
    .eq('is_active', true);

  const gbpClientIds = new Set((gbpLocs || []).map((l: any) => l.client_id));

  console.log(`${'Client Name'.padEnd(38)} | Latest GBP Date | Mar Calls | Mar Days`);
  console.log('-'.repeat(85));

  for (const client of ((clients || []) as any[])) {
    if (!gbpClientIds.has(client.id)) continue;

    const { data: latest } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, phone_calls')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(1);

    const { data: mar } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, phone_calls')
      .eq('client_id', client.id)
      .gte('date', '2026-03-01')
      .lte('date', '2026-03-09');

    const marCalls = ((mar || []) as any[]).reduce((s: number, r: any) => s + (r.phone_calls || 0), 0);
    const latestDate = ((latest || []) as any[])[0]?.date || 'NO DATA  ';
    const marDays = ((mar || []) as any[]).length;

    const flag = !((latest || []) as any[])[0]?.date
      ? ' *** NO DATA ***'
      : latestDate < '2026-02-15'
      ? ' *** STALE ***'
      : latestDate < '2026-03-01'
      ? ' * Feb lag'
      : '';

    console.log(`${client.name.padEnd(38)} | ${latestDate}      | ${String(marCalls).padStart(9)} | ${String(marDays).padStart(9)}${flag}`);
  }
}

main().catch(console.error);
