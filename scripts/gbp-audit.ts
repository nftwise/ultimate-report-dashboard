import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function main() {
  const env = fs.readFileSync('/Users/imac2017/Desktop/ultimate-report-dashboard/.env.local', 'utf8');
  const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() || '').replace(/^["']|["']$/g, '');
  const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim() || '').replace(/^["']|["']$/g, '');
  const supabase = createClient(url, key);

  const { data: gbpLocs } = await supabase
    .from('gbp_locations')
    .select('client_id')
    .eq('is_active', true);
  const gbpClientIds = [...new Set((gbpLocs||[]).map((l:any)=>l.client_id))];

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .in('id', gbpClientIds)
    .order('name');

  for (const c of (clients||[])) {
    const { data: rows } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, views, phone_calls, website_clicks, direction_requests')
      .eq('client_id', c.id)
      .gte('date', '2026-01-01')
      .order('date', { ascending: false })
      .limit(90);

    if (!rows || rows.length === 0) {
      console.log(JSON.stringify({ name: c.name, latestDate: 'NO DATA', lastViewDate: null, lastClickDate: null, lastDirDate: null, lastCallDate: null }));
      continue;
    }

    const lastView = rows.find((r:any) => r.views > 0);
    const lastClick = rows.find((r:any) => r.website_clicks > 0);
    const lastDir = rows.find((r:any) => r.direction_requests > 0);
    const lastCall = rows.find((r:any) => r.phone_calls > 0);

    const mar = rows.filter((r:any) => r.date >= '2026-03-01');
    const feb = rows.filter((r:any) => r.date >= '2026-02-01' && r.date < '2026-03-01');

    const sum = (arr: any[], field: string) => arr.reduce((s:number,r:any)=>s+(r[field]||0),0);

    console.log(JSON.stringify({
      name: c.name,
      totalRows: rows.length,
      latestDate: rows[0].date,
      lastViewDate: lastView?.date || 'NEVER',
      lastClickDate: lastClick?.date || 'NEVER',
      lastDirDate: lastDir?.date || 'NEVER',
      lastCallDate: lastCall?.date || 'NEVER',
      febViews: sum(feb,'views'), febClicks: sum(feb,'website_clicks'), febDir: sum(feb,'direction_requests'), febCalls: sum(feb,'phone_calls'),
      marViews: sum(mar,'views'), marClicks: sum(mar,'website_clicks'), marDir: sum(mar,'direction_requests'), marCalls: sum(mar,'phone_calls'),
      marDays: mar.length,
    }));
  }
}

main().catch(console.error);
