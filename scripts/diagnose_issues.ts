import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // ── 1. Impossible CTR rows ──────────────────────────────────────────────
  console.log('\n=== 1. IMPOSSIBLE CTR ROWS (clicks > impressions) ===');
  const { data: allRows } = await sb.from('ads_campaign_metrics')
    .select('client_id,date,campaign_name,clicks,impressions,cost,conversions')
    .gte('date','2026-02-01').lte('date','2026-02-28');
  const badCtr = (allRows||[]).filter(r => r.clicks > r.impressions);
  if (badCtr.length === 0) console.log('  None found!');
  else badCtr.forEach(r => console.log(`  ${r.date} | ${r.campaign_name} | clicks=${r.clicks} impressions=${r.impressions} cost=${r.cost} conv=${r.conversions}`));

  // ── 2. GBP summary columns ──────────────────────────────────────────────
  console.log('\n=== 2. GBP ROLLUP COLUMNS (Chiropractic Care Centre) ===');
  const { data: clt } = await sb.from('clients').select('id').eq('name','Chiropractic Care Centre').single();
  const cid = (clt as any)?.id;
  const { data: gbpSum } = await sb.from('client_metrics_summary')
    .select('date,gbp_calls,gbp_profile_views,gbp_website_clicks,gbp_directions')
    .eq('client_id', cid).eq('period_type','daily')
    .gte('date','2026-02-01').lte('date','2026-02-07').order('date');
  console.log('  Summary values:');
  gbpSum?.forEach(r => console.log(`  ${r.date} calls=${r.gbp_calls} views=${r.gbp_profile_views} web_clicks=${r.gbp_website_clicks} dirs=${r.gbp_directions}`));

  // Compare with raw GBP
  const { data: gbpRaw } = await sb.from('gbp_location_daily_metrics')
    .select('date,phone_calls,views,website_clicks,direction_requests')
    .eq('client_id', cid).gte('date','2026-02-01').lte('date','2026-02-07').order('date');
  console.log('\n  Raw GBP values:');
  gbpRaw?.forEach(r => console.log(`  ${r.date} phone_calls=${r.phone_calls} views=${r.views} website_clicks=${r.website_clicks} direction_requests=${r.direction_requests}`));

  // ── 3. SEO columns in summary ───────────────────────────────────────────
  console.log('\n=== 3. SEO ROLLUP COLUMNS (Chiropractic Care Centre) ===');
  const { data: seoSum } = await sb.from('client_metrics_summary')
    .select('date,seo_impressions,seo_clicks,seo_ctr,sessions,top_keywords')
    .eq('client_id', cid).eq('period_type','daily')
    .gte('date','2026-02-01').lte('date','2026-02-07').order('date');
  console.log('  Summary SEO values:');
  seoSum?.forEach(r => console.log(`  ${r.date} seo_impr=${r.seo_impressions} seo_clicks=${r.seo_clicks} sessions=${r.sessions} top_kw=${r.top_keywords}`));

  // Compare with raw GSC
  const { data: gscRaw } = await sb.from('gsc_daily_summary')
    .select('date,total_impressions,total_clicks,top_keywords_count')
    .eq('client_id', cid).gte('date','2026-02-01').lte('date','2026-02-07').order('date');
  console.log('\n  Raw GSC summary values:');
  gscRaw?.forEach(r => console.log(`  ${r.date} impr=${r.total_impressions} clicks=${r.total_clicks} top_kw=${r.top_keywords_count}`));

  // ── 4. Check rollup date to understand the gap ─────────────────────────
  console.log('\n=== 4. ROLLUP HISTORY — what dates were last updated? ===');
  const { data: recentUpdates } = await sb.from('client_metrics_summary')
    .select('date,updated_at,seo_impressions,gbp_profile_views')
    .eq('client_id', cid).eq('period_type','daily')
    .order('updated_at',{ascending:false}).limit(5);
  recentUpdates?.forEach(r => console.log(`  date=${r.date} updated=${r.updated_at?.split('T')[0]} seo_impr=${r.seo_impressions} gbp_views=${r.gbp_profile_views}`));

  // ── 5. GBP orphan clients ───────────────────────────────────────────────
  console.log('\n=== 5. GBP ORPHAN CLIENT IDs ===');
  const { data: gbpLocs } = await sb.from('gbp_locations').select('client_id,location_name,is_active');
  const { data: allClients } = await sb.from('clients').select('id,name,is_active');
  const clientNameMap = new Map((allClients||[]).map(c => [c.id, c]));
  for (const loc of gbpLocs||[]) {
    const c = clientNameMap.get(loc.client_id);
    console.log(`  ${loc.client_id} | gbp_active=${loc.is_active} | client=${c?.name||'NOT FOUND'} | client_active=${c?.is_active||false}`);
  }
}
main().catch(console.error);
