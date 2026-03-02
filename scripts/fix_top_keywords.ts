import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Fix top_keywords = 0 in client_metrics_summary for dates where gsc_daily_summary now has data
const DATES = ['2026-02-27','2026-02-28'];

async function main() {
  console.log('\n=== Fixing top_keywords in client_metrics_summary ===\n');

  let updated = 0;
  for (const date of DATES) {
    // Get top_keywords_count from gsc_daily_summary for this date
    const { data: gscRows } = await sb.from('gsc_daily_summary')
      .select('client_id,top_keywords_count')
      .eq('date', date);

    if (!gscRows || gscRows.length === 0) {
      console.log(`  ${date} — no gsc_daily_summary rows, skipping`);
      continue;
    }

    let dateUpdated = 0;
    for (const row of gscRows) {
      if (!row.top_keywords_count) continue;

      const { error } = await sb.from('client_metrics_summary')
        .update({ top_keywords: row.top_keywords_count })
        .eq('client_id', row.client_id)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (error) {
        console.log(`  ❌ ${date} ${row.client_id}: ${error.message}`);
      } else {
        dateUpdated++;
        updated++;
      }
    }
    console.log(`  ✅ ${date}: updated ${dateUpdated} summary rows`);
  }

  console.log(`\n  Total: ${updated} rows updated`);

  // Verify
  console.log('\n=== Verify top_keywords Feb 24-28 ===');
  const { data: check } = await sb.from('client_metrics_summary')
    .select('date,top_keywords')
    .eq('period_type', 'daily')
    .gte('date', '2026-02-24')
    .lte('date', '2026-02-28')
    .gt('top_keywords', 0)
    .order('date');

  const byDate: Record<string, number> = {};
  for (const r of check || []) byDate[r.date] = (byDate[r.date] || 0) + 1;
  Object.keys(byDate).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d]} clients with top_keywords > 0`);
  });
}
main().catch(console.error);
