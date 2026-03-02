import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Dates affected by the impossible CTR fix — re-aggregate ad_clicks/impressions/ctr/cpc in summary
const AFFECTED_DATES = [
  '2025-01-19','2025-01-25','2025-03-08','2025-07-04','2025-10-26',
  '2025-11-12','2025-11-13','2025-11-17','2025-11-29',
  '2025-12-01','2025-12-09','2025-12-16','2025-12-20','2025-12-24',
  '2026-01-07','2026-01-08','2026-01-30','2026-02-11','2026-02-18',
];

async function main() {
  console.log('\n=== Re-aggregating ad_clicks/ctr in client_metrics_summary ===\n');

  let fixed = 0;
  for (const date of AFFECTED_DATES) {
    // Get fresh aggregates from ads_campaign_metrics for this date
    const { data: raw } = await sb
      .from('ads_campaign_metrics')
      .select('client_id,clicks,impressions,cost')
      .eq('date', date);

    if (!raw || raw.length === 0) {
      console.log(`  ${date} — no ads rows, skipping`);
      continue;
    }

    // Group by client_id
    const byClient = new Map<string, { clicks: number; impressions: number; spend: number }>();
    for (const row of raw) {
      const cur = byClient.get(row.client_id) || { clicks: 0, impressions: 0, spend: 0 };
      cur.clicks += row.clicks || 0;
      cur.impressions += row.impressions || 0;
      cur.spend += row.cost || 0;
      byClient.set(row.client_id, cur);
    }

    for (const [clientId, agg] of byClient) {
      const adsCtr = agg.clicks > 0 && agg.impressions > 0
        ? Math.round((agg.clicks / agg.impressions) * 10000) / 100
        : 0;
      const adsAvgCpc = agg.clicks > 0
        ? Math.round((agg.spend / agg.clicks) * 100) / 100
        : 0;

      const { error } = await sb
        .from('client_metrics_summary')
        .update({
          ads_clicks: agg.clicks,
          ads_impressions: agg.impressions,
          ads_ctr: adsCtr,
          ads_avg_cpc: adsAvgCpc,
        })
        .eq('client_id', clientId)
        .eq('date', date)
        .eq('period_type', 'daily');

      if (error) {
        console.log(`  ❌ ${date} ${clientId}: ${error.message}`);
      } else {
        console.log(`  ✅ ${date} ${clientId}: clicks=${agg.clicks} impr=${agg.impressions} ctr=${adsCtr}% cpc=$${adsAvgCpc}`);
        fixed++;
      }
    }
  }

  console.log(`\n  Updated ${fixed} summary rows.`);
}
main().catch(console.error);
