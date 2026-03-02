import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DATES = ['2026-02-22','2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27','2026-02-28'];

async function main() {
  console.log('\n=== Updating client_metrics_summary GBP columns from fresh gbp_location_daily_metrics ===\n');

  let updated = 0;
  for (const date of DATES) {
    // Get fresh GBP data for this date
    const { data: raw } = await sb
      .from('gbp_location_daily_metrics')
      .select('client_id,phone_calls,views,website_clicks,direction_requests')
      .eq('date', date);

    if (!raw || raw.length === 0) {
      console.log(`  ${date} — no GBP rows`);
      continue;
    }

    // Group by client (sum across locations if multiple)
    const byClient = new Map<string, { calls: number; views: number; web: number; dirs: number }>();
    for (const r of raw) {
      const cur = byClient.get(r.client_id) || { calls: 0, views: 0, web: 0, dirs: 0 };
      cur.calls += r.phone_calls || 0;
      cur.views += r.views || 0;
      cur.web += r.website_clicks || 0;
      cur.dirs += r.direction_requests || 0;
      byClient.set(r.client_id, cur);
    }

    let dateUpdated = 0;
    for (const [clientId, agg] of byClient) {
      // Only update if there's actual non-zero data
      if (agg.calls === 0 && agg.views === 0 && agg.web === 0 && agg.dirs === 0) continue;

      const { error } = await sb
        .from('client_metrics_summary')
        .update({
          gbp_calls: agg.calls,
          gbp_profile_views: agg.views,
          gbp_website_clicks: agg.web,
          gbp_directions: agg.dirs,
        })
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (error) {
        console.log(`  ❌ ${date} ${clientId}: ${error.message}`);
      } else {
        dateUpdated++;
        updated++;
      }
    }

    // Report summary for this date
    const nonZeroClients = [...byClient.values()].filter(a => a.calls > 0 || a.views > 0 || a.web > 0 || a.dirs > 0).length;
    console.log(`  ✅ ${date}: ${nonZeroClients}/${byClient.size} clients had non-zero GBP data → updated ${dateUpdated} summary rows`);
  }

  console.log(`\n  Total updated: ${updated} rows`);

  // Verify
  console.log('\n=== Verification: gbp_profile_views by date ===');
  const { data: check } = await sb
    .from('client_metrics_summary')
    .select('date,gbp_profile_views,gbp_calls')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-20')
    .lte('date', '2026-02-28')
    .gt('gbp_profile_views', 0)
    .order('date');

  const byDate: Record<string, number> = {};
  for (const r of check || []) {
    byDate[r.date] = (byDate[r.date] || 0) + 1;
  }
  Object.keys(byDate).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d]} clients with gbp_profile_views > 0`);
  });
}
main().catch(console.error);
