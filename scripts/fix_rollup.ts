import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function processClient(clientId: string, date: string) {
  const [ga4Res, eventsRes, gscRes, adsRes, gbpRes] = await Promise.all([
    sb.from('ga4_sessions').select('sessions,new_users,engagement_rate,source_medium').eq('client_id', clientId).eq('date', date),
    sb.from('ga4_events').select('event_count').eq('client_id', clientId).eq('date', date).ilike('event_name', '%success%'),
    sb.from('gsc_daily_summary').select('total_impressions,total_clicks,top_keywords_count').eq('client_id', clientId).eq('date', date).single(),
    sb.from('ads_campaign_metrics').select('cost,impressions,clicks,conversions').eq('client_id', clientId).eq('date', date),
    sb.from('gbp_location_daily_metrics').select('phone_calls,website_clicks,direction_requests,views').eq('client_id', clientId).eq('date', date),
  ]);

  const ga4 = ga4Res.data || [];
  const sessions   = ga4.reduce((s: number, r: any) => s + (r.sessions || 0), 0);
  const new_users  = ga4.reduce((s: number, r: any) => s + (r.new_users || 0), 0);

  // Traffic breakdown by source_medium
  let traffic_organic = 0, traffic_paid = 0, traffic_direct = 0, traffic_referral = 0, traffic_ai = 0;
  for (const r of ga4) {
    const sm = (r.source_medium || '').toLowerCase();
    const s = r.sessions || 0;
    if (sm.includes('google / cpc') || sm.includes('cpc')) traffic_paid += s;
    else if (sm.includes('organic')) traffic_organic += s;
    else if (sm === '(direct) / (none)' || sm.includes('direct')) traffic_direct += s;
    else if (sm.includes('perplexity') || sm.includes('chatgpt') || sm.includes('claude') || sm.includes('gemini') || sm.includes('copilot')) traffic_ai += s;
    else traffic_referral += s;
  }

  const form_fills = (eventsRes.data || []).reduce((s: number, r: any) => s + (r.event_count || 0), 0);

  const gsc = gscRes.data;
  const seo_impressions = gsc?.total_impressions || 0;
  const seo_clicks = gsc?.total_clicks || 0;
  const seo_ctr = seo_impressions > 0 ? seo_clicks / seo_impressions : 0;
  const top_keywords = gsc?.top_keywords_count || 0;

  const ads = adsRes.data || [];
  const ad_spend = ads.reduce((s: number, r: any) => s + parseFloat(r.cost || 0), 0);
  const ads_impressions = ads.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
  const ads_clicks = ads.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
  const google_ads_conversions = ads.reduce((s: number, r: any) => s + parseFloat(r.conversions || 0), 0);
  const cpl = google_ads_conversions > 0 ? ad_spend / google_ads_conversions : 0;
  const ads_ctr = ads_impressions > 0 ? ads_clicks / ads_impressions : 0;
  const ads_avg_cpc = ads_clicks > 0 ? ad_spend / ads_clicks : 0;
  const ads_conversion_rate = ads_clicks > 0 ? google_ads_conversions / ads_clicks : 0;

  const gbp = gbpRes.data || [];
  const gbp_calls = gbp.reduce((s: number, r: any) => s + (r.phone_calls || 0), 0);
  const gbp_website_clicks = gbp.reduce((s: number, r: any) => s + (r.website_clicks || 0), 0);
  const gbp_directions = gbp.reduce((s: number, r: any) => s + (r.direction_requests || 0), 0);
  const gbp_profile_views = gbp.reduce((s: number, r: any) => s + (r.views || 0), 0);

  const total_leads = form_fills + google_ads_conversions + gbp_calls;

  return {
    client_id: clientId, date, period_type: 'daily',
    sessions, new_users,
    traffic_organic, traffic_paid, traffic_direct, traffic_referral, traffic_ai,
    form_fills, top_keywords,
    seo_impressions, seo_clicks, seo_ctr,
    ad_spend, ads_impressions, ads_clicks, google_ads_conversions, cpl,
    ads_ctr, ads_avg_cpc, ads_conversion_rate,
    gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views,
    total_leads,
    updated_at: new Date().toISOString(),
  };
}

async function rollupDate(date: string) {
  const { data: clients } = await sb.from('clients').select('id, name').eq('is_active', true);
  const rows = await Promise.all((clients || []).map(c => processClient(c.id, date)));
  const { error } = await sb.from('client_metrics_summary')
    .upsert(rows, { onConflict: 'client_id,date,period_type' });
  if (error) { console.error(`[${date}] upsert error:`, error.message); return; }
  console.log(`[${date}] ✓ ${rows.length} clients updated`);
  // Spot check
  const { data: check } = await sb.from('client_metrics_summary')
    .select('client_id, sessions, ad_spend, total_leads')
    .eq('date', date).eq('period_type','daily')
    .gt('sessions', 0);
  const spendOk = check?.filter(r => (r.ad_spend||0) > 0).length || 0;
  console.log(`  → sessions>0: ${check?.length || 0}/18, ad_spend>0: ${spendOk}/18`);
}

async function main() {
  console.log('Re-running rollup for Feb 27 and Feb 28 2026...');
  await rollupDate('2026-02-27');
  await rollupDate('2026-02-28');
  console.log('\nDone. Final summary:');
  for (const date of ['2026-02-27','2026-02-28']) {
    const { data } = await sb.from('client_metrics_summary')
      .select('sessions,total_leads,ad_spend')
      .eq('date', date).eq('period_type','daily');
    const s = (data||[]).filter(r=>(r.sessions||0)>0).length;
    const sp = (data||[]).filter(r=>(r.ad_spend||0)>0).length;
    const l = (data||[]).filter(r=>(r.total_leads||0)>0).length;
    console.log(`${date}: sessions>0=${s}/18, spend>0=${sp}/18, leads>0=${l}/18`);
  }
}
main();
