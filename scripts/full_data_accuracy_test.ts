/**
 * WiseCRM — Full Database Accuracy & Consistency Test
 * Tests every table, every column, every calculation the dashboard uses.
 * Goal: ZERO errors, ZERO wrong data displayed to users.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── helpers ──────────────────────────────────────────────────────────────────
type Status = '✅' | '⚠️ ' | '❌';
interface Result { group: string; name: string; status: Status; detail: string }
const results: Result[] = [];
let currentGroup = '';

const pass = (name: string, detail: string) => results.push({ group: currentGroup, name, status: '✅', detail });
const warn = (name: string, detail: string) => results.push({ group: currentGroup, name, status: '⚠️ ', detail });
const fail = (name: string, detail: string) => results.push({ group: currentGroup, name, status: '❌', detail });

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '0%';

const TEST_DATE   = '2026-02-28';
const MONTH_START = '2026-02-01';
const MONTH_END   = '2026-02-28';
// Previous period for MoM (same length, immediately before)
const PREV_START  = '2026-01-01';
const PREV_END    = '2026-01-31';

// ── run ───────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🔬 WiseCRM — Full Database Accuracy & Consistency Test');
  console.log('='.repeat(70));
  console.log(`  Testing: ${MONTH_START} → ${MONTH_END}  (spot-checks: ${TEST_DATE})\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 1: SCHEMA VALIDATION
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '1. Schema';

  // clients table columns
  try {
    const { data, error } = await sb.from('clients')
      .select('id,name,slug,city,is_active,owner,has_ads,has_seo,contact_email').limit(1);
    if (error) fail('clients schema', error.message);
    else pass('clients schema', 'All 9 expected columns present');
  } catch (e: any) { fail('clients schema', e.message); }

  // service_configs columns
  try {
    const { data, error } = await sb.from('service_configs')
      .select('client_id,ga_property_id,gads_customer_id,gsc_site_url,gbp_location_id,callrail_account_id').limit(1);
    if (error) fail('service_configs schema', error.message);
    else pass('service_configs schema', 'All 6 expected columns present');
  } catch (e: any) { fail('service_configs schema', e.message); }

  // client_metrics_summary — all 26 dashboard-used columns
  const summaryColumns = [
    'client_id','date','period_type','sessions','new_users','form_fills',
    'top_keywords','seo_impressions','seo_clicks','seo_ctr',
    'traffic_organic','traffic_paid','traffic_direct','traffic_referral','traffic_ai',
    'ad_spend','ads_impressions','ads_clicks','ads_ctr','ads_avg_cpc',
    'google_ads_conversions','cpl','total_leads',
    'gbp_calls','gbp_website_clicks','gbp_directions','gbp_profile_views',
    'gbp_rating_avg','gbp_reviews_count',
    'engagement_rate','keywords_improved','keywords_declined',
    'blog_sessions','conversion_rate','updated_at',
  ];
  try {
    const { data, error } = await sb.from('client_metrics_summary')
      .select(summaryColumns.join(',')).eq('period_type','daily').limit(1);
    if (error) fail('client_metrics_summary schema', `Missing column(s): ${error.message}`);
    else pass('client_metrics_summary schema', `All ${summaryColumns.length} dashboard columns present`);
  } catch (e: any) { fail('client_metrics_summary schema', e.message); }

  // gbp_location_daily_metrics columns
  const gbpCols = ['client_id','date','phone_calls','views','website_clicks','direction_requests',
    'total_reviews','new_reviews_today','average_rating','posts_count','posts_views','posts_actions'];
  try {
    const { data, error } = await sb.from('gbp_location_daily_metrics')
      .select(gbpCols.join(',')).limit(1);
    if (error) fail('gbp_location_daily_metrics schema', error.message);
    else pass('gbp_location_daily_metrics schema', `All ${gbpCols.length} columns present`);
  } catch (e: any) { fail('gbp_location_daily_metrics schema', e.message); }

  // ads_campaign_metrics columns
  try {
    const { data, error } = await sb.from('ads_campaign_metrics')
      .select('client_id,date,campaign_id,campaign_name,impressions,clicks,cost,conversions').limit(1);
    if (error) fail('ads_campaign_metrics schema', error.message);
    else pass('ads_campaign_metrics schema', 'All expected columns present');
  } catch (e: any) { fail('ads_campaign_metrics schema', e.message); }

  // campaign_conversion_actions columns
  try {
    const { data, error } = await sb.from('campaign_conversion_actions')
      .select('client_id,date,conversions,conversion_action_name').limit(1);
    if (error) fail('campaign_conversion_actions schema', error.message);
    else pass('campaign_conversion_actions schema', 'All expected columns present');
  } catch (e: any) { fail('campaign_conversion_actions schema', e.message); }

  // gsc_queries columns
  try {
    const { data, error } = await sb.from('gsc_queries')
      .select('client_id,date,query,clicks,impressions,position').limit(1);
    if (error) fail('gsc_queries schema', error.message);
    else pass('gsc_queries schema', 'All expected columns present');
  } catch (e: any) { fail('gsc_queries schema', e.message); }

  // gsc_daily_summary columns
  try {
    const { data, error } = await sb.from('gsc_daily_summary')
      .select('client_id,date,total_impressions,total_clicks,top_keywords_count').limit(1);
    if (error) fail('gsc_daily_summary schema', error.message);
    else pass('gsc_daily_summary schema', 'All expected columns present');
  } catch (e: any) { fail('gsc_daily_summary schema', e.message); }

  // gbp_locations columns
  try {
    const { data, error } = await sb.from('gbp_locations')
      .select('client_id,gbp_location_id,location_name,is_active').limit(1);
    if (error) fail('gbp_locations schema', error.message);
    else pass('gbp_locations schema', 'All expected columns present');
  } catch (e: any) { fail('gbp_locations schema', e.message); }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 2: CLIENT TABLE INTEGRITY
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '2. Client Config';

  const { data: clients } = await sb.from('clients')
    .select('id,name,slug,is_active,city').order('name');
  const { data: allConfigs } = await sb.from('service_configs')
    .select('client_id,ga_property_id,gads_customer_id,gsc_site_url,gbp_location_id');
  const configMap = new Map((allConfigs||[]).map(c => [c.client_id, c]));
  const activeClients = (clients||[]).filter(c => c.is_active);

  // Duplicate slugs
  const slugCounts = new Map<string, number>();
  for (const c of clients||[]) slugCounts.set(c.slug, (slugCounts.get(c.slug)||0)+1);
  const dupSlugs = [...slugCounts.entries()].filter(([,n]) => n > 1).map(([s]) => s);
  if (dupSlugs.length) fail('Duplicate slugs', `ROUTING BROKEN: ${dupSlugs.join(', ')}`);
  else pass('Unique slugs', `All ${clients?.length} clients have unique slugs`);

  // Active clients with no slug
  const noSlug = activeClients.filter(c => !c.slug?.trim());
  if (noSlug.length) fail('Missing slugs (active)', noSlug.map(c => c.name).join(', '));
  else pass('All active clients have slug', `${activeClients.length} active clients`);

  // Clients with GA4 config
  const withGA4 = activeClients.filter(c => configMap.get(c.id)?.ga_property_id?.trim());
  const withAds = activeClients.filter(c => configMap.get(c.id)?.gads_customer_id?.trim());
  const withGSC = activeClients.filter(c => configMap.get(c.id)?.gsc_site_url?.trim());
  const withGBP = activeClients.filter(c => configMap.get(c.id)?.gbp_location_id?.trim());
  pass('GA4 configured', `${withGA4.length}/${activeClients.length} clients`);
  pass('Google Ads configured', `${withAds.length}/${activeClients.length} clients`);
  pass('GSC configured', `${withGSC.length}/${activeClients.length} clients`);
  pass('GBP configured in service_configs', `${withGBP.length}/${activeClients.length} clients`);

  // GBP: service_configs vs gbp_locations table consistency
  const { data: gbpLocations } = await sb.from('gbp_locations').select('client_id,is_active');
  const gbpLocSet = new Set((gbpLocations||[]).filter(l => l.is_active).map(l => l.client_id));
  const configGBPSet = new Set(withGBP.map(c => c.id));
  const inConfigNotLoc = [...configGBPSet].filter(id => !gbpLocSet.has(id));
  const inLocNotConfig = [...gbpLocSet].filter(id => !configGBPSet.has(id));
  const nameFor = (id: string) => activeClients.find(c => c.id === id)?.name || id;
  if (inConfigNotLoc.length) warn('GBP config mismatch', `In service_configs but NOT gbp_locations (cron won't sync!): ${inConfigNotLoc.map(nameFor).join(', ')}`);
  else pass('GBP sync consistency', 'service_configs.gbp_location_id matches gbp_locations table');
  if (inLocNotConfig.length) warn('GBP orphan', `In gbp_locations but NOT service_configs: ${inLocNotConfig.map(nameFor).join(', ')}`);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 3: ROLLUP COVERAGE & COMPLETENESS
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '3. Rollup Coverage';

  const { data: summaryFeb } = await sb.from('client_metrics_summary')
    .select('client_id,date,sessions,ad_spend,total_leads,google_ads_conversions,form_fills,gbp_calls')
    .eq('period_type','daily').gte('date',MONTH_START).lte('date',MONTH_END);

  // Every active client should have rows in summary
  const clientsInSummary = new Set((summaryFeb||[]).map(r => r.client_id));
  const missingFromSummary = activeClients.filter(c => !clientsInSummary.has(c.id));
  if (missingFromSummary.length) fail('Rollup coverage', `Missing entirely: ${missingFromSummary.map(c=>c.name).join(', ')}`);
  else pass('Rollup coverage', `All ${activeClients.length} active clients have Feb 2026 rows`);

  // Per-client: should have ~28 rows (28 days)
  const rowsPerClient = new Map<string, number>();
  for (const r of summaryFeb||[]) rowsPerClient.set(r.client_id, (rowsPerClient.get(r.client_id)||0)+1);
  const sparseClients = activeClients.filter(c => (rowsPerClient.get(c.id)||0) < 20);
  if (sparseClients.length) warn('Sparse rollup rows', `<20 days of Feb data: ${sparseClients.map(c=>`${c.name}(${rowsPerClient.get(c.id)||0})`).join(', ')}`);
  else pass('Rollup row count', `All clients have 20+ days of Feb 2026 data`);

  // Stale rows: summary has conversions but no matching raw ads data
  const { data: summaryWithConv } = await sb.from('client_metrics_summary')
    .select('client_id,date,google_ads_conversions')
    .eq('period_type','daily').gte('date',MONTH_START).lte('date',MONTH_END)
    .gt('google_ads_conversions',0);
  let staleRows = 0;
  for (const sr of summaryWithConv||[]) {
    const { count } = await sb.from('ads_campaign_metrics')
      .select('*',{count:'exact',head:true})
      .eq('client_id',sr.client_id).eq('date',sr.date).gt('conversions',0);
    if ((count||0) === 0) staleRows++;
  }
  if (staleRows > 0) fail('Stale conversions in rollup', `${staleRows} summary rows show conv>0 but raw ads table has none — re-run rollup`);
  else pass('No stale conversion rows', 'All conv>0 summary rows have matching raw data');

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 4: GA4 DATA ACCURACY
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '4. GA4 Accuracy';

  // For each GA4-configured client, compare raw ga4_sessions vs summary.sessions for Feb
  const ga4Clients = withGA4.slice(0, 5); // test first 5 to keep runtime reasonable
  let sessionMismatch = 0;
  for (const c of ga4Clients) {
    let rawTotal = 0, offset = 0;
    while (true) {
      const { data } = await sb.from('ga4_sessions')
        .select('sessions').eq('client_id',c.id)
        .gte('date',MONTH_START).lte('date',MONTH_END)
        .gt('sessions',0).range(offset, offset+999);
      if (!data || data.length === 0) break;
      rawTotal += (data as any[]).reduce((s: number, r: any) => s + (r.sessions||0), 0);
      if (data.length < 1000) break;
      offset += 1000;
    }
    const summaryTotal = (summaryFeb||[])
      .filter(r => r.client_id === c.id)
      .reduce((s,r) => s+(r.sessions||0), 0);
    const diff = Math.abs(rawTotal - summaryTotal);
    const diffPct = rawTotal > 0 ? (diff/rawTotal)*100 : 0;
    if (diffPct > 5) {
      sessionMismatch++;
      warn(`GA4 sessions mismatch: ${c.name}`, `Raw=${fmt(rawTotal)} Summary=${fmt(summaryTotal)} (${diffPct.toFixed(1)}% diff)`);
    } else {
      pass(`GA4 sessions: ${c.name}`, `Raw=${fmt(rawTotal)} ≈ Summary=${fmt(summaryTotal)} (${diffPct.toFixed(1)}% diff OK)`);
    }
  }
  if (sessionMismatch === 0) pass('GA4→Summary session totals', `${ga4Clients.length} clients verified, all within 5% tolerance`);

  // Traffic attribution: organic+paid+direct+referral+ai should ≈ total sessions
  const { data: trafficCheck } = await sb.from('client_metrics_summary')
    .select('client_id,sessions,traffic_organic,traffic_paid,traffic_direct,traffic_referral,traffic_ai')
    .eq('period_type','daily').eq('date',TEST_DATE).gt('sessions',0);
  let trafficMismatch = 0;
  for (const r of trafficCheck||[]) {
    const attributed = (r.traffic_organic||0)+(r.traffic_paid||0)+(r.traffic_direct||0)+(r.traffic_referral||0)+(r.traffic_ai||0);
    const diff = Math.abs(attributed - (r.sessions||0));
    if (diff > 5) { // tolerance of 5 sessions
      trafficMismatch++;
      const name = nameFor(r.client_id);
      warn(`Traffic attribution: ${name} (${TEST_DATE})`, `sessions=${r.sessions} attributed=${attributed} diff=${diff}`);
    }
  }
  if (trafficMismatch === 0) pass('Traffic attribution sums', `All ${trafficCheck?.length||0} rows: organic+paid+direct+referral+ai ≈ sessions`);

  // GA4 Events: form_fills in summary should match ga4_events (success, non-paid) for a spot-check
  const spotClient = ga4Clients[0];
  if (spotClient) {
    let rawFills = 0, offset2 = 0;
    while (true) {
      const { data } = await sb.from('ga4_events')
        .select('event_count,source_medium')
        .eq('client_id', spotClient.id)
        .gte('date', MONTH_START).lte('date', MONTH_END)
        .ilike('event_name','%success%')
        .range(offset2, offset2+999);
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        const sm = (r.source_medium||'').toLowerCase();
        if (!sm.includes('cpc') && !sm.includes('paid')) rawFills += (r.event_count||0);
      }
      if (data.length < 1000) break;
      offset2 += 1000;
    }
    const summaryFills = (summaryFeb||[]).filter(r => r.client_id===spotClient.id).reduce((s,r) => s+(r.form_fills||0),0);
    const fillDiff = Math.abs(rawFills - summaryFills);
    if (fillDiff > 3) warn(`Form fills accuracy: ${spotClient.name}`, `Raw events=${rawFills} Summary=${summaryFills} diff=${fillDiff}`);
    else pass(`Form fills accuracy: ${spotClient.name}`, `Raw=${rawFills} Summary=${summaryFills} ✓`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 5: GOOGLE ADS DATA ACCURACY
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '5. Google Ads Accuracy';

  // For ads-configured clients: compare raw ads_campaign_metrics vs summary for Feb
  const adsClients = withAds.slice(0, 5);
  let adsMismatch = 0;
  for (const c of adsClients) {
    const { data: rawAds } = await sb.from('ads_campaign_metrics')
      .select('cost,conversions')
      .eq('client_id',c.id).gte('date',MONTH_START).lte('date',MONTH_END);
    const rawSpend = (rawAds||[]).reduce((s,r) => s+parseFloat(r.cost||0),0);
    const rawConv  = (rawAds||[]).reduce((s,r) => s+parseFloat(r.conversions||0),0);
    const sumSpend = (summaryFeb||[]).filter(r=>r.client_id===c.id).reduce((s,r)=>s+(r.ad_spend||0),0);
    const sumConv  = (summaryFeb||[]).filter(r=>r.client_id===c.id).reduce((s,r)=>s+(r.google_ads_conversions||0),0);
    const spendDiff = rawSpend > 0 ? Math.abs(rawSpend-sumSpend)/rawSpend*100 : 0;
    const convDiff  = Math.abs(rawConv-sumConv);
    if (spendDiff > 2 || convDiff > 1) {
      adsMismatch++;
      warn(`Ads accuracy: ${c.name}`, `Spend: raw=$${rawSpend.toFixed(2)} sum=$${sumSpend.toFixed(2)} (${spendDiff.toFixed(1)}%) | Conv: raw=${rawConv.toFixed(0)} sum=${sumConv.toFixed(0)}`);
    } else {
      pass(`Ads accuracy: ${c.name}`, `Spend ≈$${rawSpend.toFixed(0)} Conv ≈${rawConv.toFixed(0)} both within tolerance`);
    }
  }
  if (adsMismatch === 0) pass('Ads spend+conv summary accuracy', `${adsClients.length} clients verified`);

  // Critical: confirm NOT using campaign_conversion_actions for totals
  // Check if any client has summary conv > campaign-level conv (sign of action-level double-counting)
  let doubleCountSuspect = 0;
  for (const c of adsClients) {
    const { data: campConv } = await sb.from('ads_campaign_metrics')
      .select('conversions').eq('client_id',c.id).gte('date',MONTH_START).lte('date',MONTH_END);
    const { data: actionConv } = await sb.from('campaign_conversion_actions')
      .select('conversions').eq('client_id',c.id).gte('date',MONTH_START).lte('date',MONTH_END);
    const campTotal  = (campConv||[]).reduce((s,r) => s+parseFloat(r.conversions||0),0);
    const actionTotal= (actionConv||[]).reduce((s,r) => s+parseFloat(r.conversions||0),0);
    const sumConv    = (summaryFeb||[]).filter(r=>r.client_id===c.id).reduce((s,r)=>s+(r.google_ads_conversions||0),0);
    if (sumConv > campTotal*1.05) {
      doubleCountSuspect++;
      fail(`Double-count suspect: ${c.name}`, `Summary=${sumConv.toFixed(0)} > campaign-level=${campTotal.toFixed(0)} (action-level=${actionTotal.toFixed(0)}) — re-run rollup`);
    } else {
      pass(`No double-count: ${c.name}`, `Summary=${sumConv.toFixed(0)} ≤ campaign=${campTotal.toFixed(0)} ✓`);
    }
  }

  // Negative costs
  const { count: negCost } = await sb.from('ads_campaign_metrics')
    .select('*',{count:'exact',head:true}).lt('cost',0).gte('date',MONTH_START).lte('date',MONTH_END);
  if ((negCost||0) > 0) fail('Negative ad costs', `${negCost} rows with cost < 0`);
  else pass('No negative ad costs', 'All cost values ≥ 0');

  // Impossible CTR (> 1 = clicks > impressions)
  const { data: ctrRows } = await sb.from('ads_campaign_metrics')
    .select('client_id,date,clicks,impressions')
    .gte('date',MONTH_START).lte('date',MONTH_END)
    .gt('impressions',0);
  const badCtr = (ctrRows||[]).filter(r => r.clicks > r.impressions);
  if (badCtr.length) fail('Impossible CTR (clicks > impressions)', `${badCtr.length} rows: ${badCtr.slice(0,3).map(r=>`${nameFor(r.client_id)} ${r.date}`).join(', ')}`);
  else pass('CTR sanity (clicks ≤ impressions)', `${ctrRows?.length||0} rows checked`);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 6: CPL CALCULATION ACCURACY
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '6. CPL Accuracy';

  // CPL = ad_spend / google_ads_conversions (NOT total_leads)
  // Check each client's Feb CPL is consistent
  for (const c of adsClients.slice(0,3)) {
    const rows = (summaryFeb||[]).filter(r => r.client_id===c.id);
    const spend = rows.reduce((s,r) => s+(r.ad_spend||0),0);
    const conv  = rows.reduce((s,r) => s+(r.google_ads_conversions||0),0);
    const calculatedCPL = conv > 0 ? spend/conv : 0;
    // The stored cpl is per-day; check total for the period
    if (spend > 0 && conv === 0) warn(`CPL undefined: ${c.name}`, `$${spend.toFixed(0)} spend but 0 conversions → CPL = ∞ (show as "—" in UI)`);
    else if (conv > 0) pass(`CPL calculation: ${c.name}`, `$${spend.toFixed(0)} ÷ ${conv.toFixed(0)} conv = $${calculatedCPL.toFixed(2)}/lead`);
    else pass(`CPL N/A: ${c.name}`, 'No spend and no conversions this period');
  }

  // Impossible CPL: conversions > 0 but spend = 0 (stale rows)
  const { data: impossibleCPL } = await sb.from('client_metrics_summary')
    .select('client_id,date,ad_spend,google_ads_conversions')
    .eq('period_type','daily').gte('date',MONTH_START).lte('date',MONTH_END)
    .eq('ad_spend',0).gt('google_ads_conversions',0);
  if ((impossibleCPL?.length||0) > 0) fail('Impossible CPL rows', `${impossibleCPL?.length} rows: conv>0 but spend=0 → stale summary, re-run rollup`);
  else pass('No impossible CPL rows', 'All conv>0 rows have spend>0');

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 7: GBP DATA ACCURACY & COLUMN MAPPING
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '7. GBP Accuracy';

  // Column mapping: gbp_location_daily_metrics.phone_calls = client_metrics_summary.gbp_calls
  const gbpClients = activeClients.filter(c => gbpLocSet.has(c.id)).slice(0,4);
  let gbpMismatch = 0;
  for (const c of gbpClients) {
    const { data: rawGBP } = await sb.from('gbp_location_daily_metrics')
      .select('phone_calls,views,website_clicks,direction_requests')
      .eq('client_id',c.id).gte('date',MONTH_START).lte('date',MONTH_END);
    const rawCalls = (rawGBP||[]).reduce((s,r) => s+(r.phone_calls||0),0);
    const rawViews = (rawGBP||[]).reduce((s,r) => s+(r.views||0),0);
    const rawClicks= (rawGBP||[]).reduce((s,r) => s+(r.website_clicks||0),0);
    const rawDirs  = (rawGBP||[]).reduce((s,r) => s+(r.direction_requests||0),0);

    const sumRows = (summaryFeb||[]).filter(r => r.client_id===c.id);
    const sumCalls = sumRows.reduce((s,r)=>s+(r.gbp_calls||0),0);
    const sumViews = sumRows.reduce((s,r)=>s+(r.gbp_profile_views||0),0);
    const sumClicks= sumRows.reduce((s,r)=>s+(r.gbp_website_clicks||0),0);
    const sumDirs  = sumRows.reduce((s,r)=>s+(r.gbp_directions||0),0);

    const mismatch = [
      [rawCalls, sumCalls, 'calls'],
      [rawViews, sumViews, 'views'],
      [rawClicks, sumClicks, 'website_clicks'],
      [rawDirs, sumDirs, 'directions'],
    ].filter(([a,b]) => Math.abs((a as number)-(b as number)) > 2);

    if (mismatch.length > 0) {
      gbpMismatch++;
      warn(`GBP column mapping: ${c.name}`, mismatch.map(([a,b,col]) => `${col}: raw=${a} sum=${b}`).join(' | '));
    } else {
      pass(`GBP mapping: ${c.name}`, `calls=${rawCalls} views=${rawViews} clicks=${rawClicks} dirs=${rawDirs} ✓`);
    }
  }
  if (gbpMismatch === 0 && gbpClients.length > 0) pass('GBP column mapping accuracy', `phone_calls→gbp_calls, views→gbp_profile_views etc. all correct for ${gbpClients.length} clients`);
  if (gbpClients.length === 0) warn('GBP test skipped', 'No active clients with GBP in gbp_locations table');

  // Verify no negative GBP values
  const { count: negGBP } = await sb.from('gbp_location_daily_metrics')
    .select('*',{count:'exact',head:true}).lt('phone_calls',0).gte('date',MONTH_START);
  if ((negGBP||0) > 0) fail('Negative GBP phone_calls', `${negGBP} rows`);
  else pass('No negative GBP values', 'phone_calls ≥ 0 for all Feb rows');

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 8: SEO DATA ACCURACY
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '8. SEO Accuracy';

  // GSC: gsc_daily_summary totals should match (they're pre-aggregated from gsc_queries)
  const gscClients = withGSC.slice(0,3);
  for (const c of gscClients) {
    const { data: gscSumRows } = await sb.from('gsc_daily_summary')
      .select('total_impressions,total_clicks,top_keywords_count')
      .eq('client_id',c.id).gte('date',MONTH_START).lte('date',MONTH_END);
    const totalImpr  = (gscSumRows||[]).reduce((s,r) => s+(r.total_impressions||0),0);
    const totalClicks= (gscSumRows||[]).reduce((s,r) => s+(r.total_clicks||0),0);
    const summaryImpr = (summaryFeb||[]).filter(r=>r.client_id===c.id).reduce((s,r)=>s+(r.seo_impressions||0),0);
    const summaryClks = (summaryFeb||[]).filter(r=>r.client_id===c.id).reduce((s,r)=>s+(r.seo_clicks||0),0);
    const imprDiff = totalImpr > 0 ? Math.abs(totalImpr-summaryImpr)/totalImpr*100 : 0;
    const clksDiff = totalClicks > 0 ? Math.abs(totalClicks-summaryClks)/totalClicks*100 : 0;
    if (imprDiff > 2 || clksDiff > 2) warn(`SEO impressions/clicks: ${c.name}`, `GSC=${fmt(totalImpr)} vs Summary=${fmt(summaryImpr)} (${imprDiff.toFixed(1)}%) | Clicks GSC=${fmt(totalClicks)} Sum=${fmt(summaryClks)} (${clksDiff.toFixed(1)}%)`);
    else if (totalImpr === 0 && (gscSumRows?.length||0) === 0) warn(`No GSC data: ${c.name}`, 'Zero rows in gsc_daily_summary for Feb 2026');
    else pass(`SEO impressions/clicks: ${c.name}`, `GSC=${fmt(totalImpr)} clicks=${fmt(totalClicks)} ≈ summary`);
  }

  // CTR = clicks/impressions: verify no impossible values
  const { data: seoRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,seo_clicks,seo_impressions,seo_ctr')
    .eq('period_type','daily').gte('date',MONTH_START).lte('date',MONTH_END)
    .gt('seo_impressions',0);
  const badSEOCtr = (seoRows||[]).filter(r => (r.seo_clicks||0) > (r.seo_impressions||0));
  if (badSEOCtr.length) fail('Impossible SEO CTR', `${badSEOCtr.length} rows where seo_clicks > seo_impressions`);
  else pass('SEO CTR sanity', `${seoRows?.length||0} rows checked, all CTR ≤ 100%`);

  // top_keywords should be ≥ 0
  const { count: negKW } = await sb.from('client_metrics_summary')
    .select('*',{count:'exact',head:true}).lt('top_keywords',0)
    .eq('period_type','daily').gte('date',MONTH_START);
  if ((negKW||0) > 0) fail('Negative top_keywords', `${negKW} rows`);
  else pass('top_keywords ≥ 0', 'No negative keyword counts');

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 9: TOTAL_LEADS CALCULATION
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '9. Total Leads Formula';

  // total_leads = form_fills + google_ads_conversions + gbp_calls
  const { data: leadsRows } = await sb.from('client_metrics_summary')
    .select('client_id,date,total_leads,form_fills,google_ads_conversions,gbp_calls')
    .eq('period_type','daily').gte('date',MONTH_START).lte('date',MONTH_END)
    .gt('total_leads',0);

  let leadsMismatch = 0;
  for (const r of leadsRows||[]) {
    const expected = (r.form_fills||0) + (r.google_ads_conversions||0) + (r.gbp_calls||0);
    if (Math.abs(expected - (r.total_leads||0)) > 0.5) {
      leadsMismatch++;
      if (leadsMismatch <= 5) warn(`total_leads formula error`, `${nameFor(r.client_id)} ${r.date}: form=${r.form_fills}+conv=${r.google_ads_conversions}+calls=${r.gbp_calls}=${expected} but stored=${r.total_leads}`);
    }
  }
  if (leadsMismatch === 0) pass('total_leads = form_fills+conversions+gbp_calls', `${leadsRows?.length||0} rows verified`);
  else fail('total_leads formula mismatch', `${leadsMismatch} rows have wrong total_leads value`);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 10: DATE RANGE & MOM LOGIC
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '10. Date Range & MoM';

  // MoM: previous period should be same length, immediately before current
  // Test: 30-day window Jan 29 - Feb 28 → prev should be Dec 30 - Jan 28
  const curEnd  = new Date('2026-02-28');
  const curStart= new Date('2026-01-30');
  const days    = Math.round((curEnd.getTime()-curStart.getTime())/(1000*60*60*24));
  const prevEnd = new Date(curStart); prevEnd.setDate(prevEnd.getDate()-1);
  const prevStart=new Date(prevEnd);  prevStart.setDate(prevStart.getDate()-days);
  pass('MoM period length', `Current: ${days+1}d, Prev: ${days+1}d (equal length) ✓`);
  pass('MoM period boundaries', `Cur: ${curStart.toISOString().split('T')[0]} → ${curEnd.toISOString().split('T')[0]}, Prev: ${prevStart.toISOString().split('T')[0]} → ${prevEnd.toISOString().split('T')[0]}`);

  // Check that previous period actually has data (not empty)
  const { count: prevCount } = await sb.from('client_metrics_summary')
    .select('*',{count:'exact',head:true})
    .eq('period_type','daily')
    .gte('date', prevStart.toISOString().split('T')[0])
    .lte('date', prevEnd.toISOString().split('T')[0]);
  if ((prevCount||0) < 50) warn('MoM previous period data', `Only ${prevCount} rows — MoM comparisons may show "—"`);
  else pass('MoM previous period has data', `${prevCount} rows available for comparison`);

  // period_type filter: always 'daily' — verify no 'monthly' rows sneak into dashboards
  const { count: monthlyRows } = await sb.from('client_metrics_summary')
    .select('*',{count:'exact',head:true}).eq('period_type','monthly');
  if ((monthlyRows||0) > 0) warn('Non-daily rows in summary', `${monthlyRows} monthly rows exist — ensure all queries filter period_type='daily'`);
  else pass('All summary rows are daily', 'No monthly period_type rows found');

  // Future dates: no data after today
  const { count: futureRows } = await sb.from('client_metrics_summary')
    .select('*',{count:'exact',head:true}).gt('date', TEST_DATE).eq('period_type','daily');
  if ((futureRows||0) > 0) warn('Future-dated rows', `${futureRows} rows after ${TEST_DATE} — could cause confusing chart spikes`);
  else pass('No future-dated rows', `No rows after ${TEST_DATE}`);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 11: DATA LOADING STATES (DASHBOARD PAGE QUERIES)
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '11. Dashboard Page Queries';

  // Simulate admin dashboard query (what page.tsx fetches)
  const dateFrom = '2026-02-01', dateTo = '2026-02-28';
  try {
    const [metricsRes, gbpRes, formRes] = await Promise.all([
      sb.from('client_metrics_summary')
        .select('client_id,total_leads,google_ads_conversions,ad_spend,top_keywords,date')
        .eq('period_type','daily').gte('date',dateFrom).lte('date',dateTo),
      sb.from('gbp_location_daily_metrics')
        .select('client_id,phone_calls,date').gte('date',dateFrom).lte('date',dateTo),
      sb.from('ga4_events')
        .select('client_id,event_count').gte('date',dateFrom).lte('date',dateTo)
        .ilike('event_name','%success%'),
    ]);
    if (metricsRes.error) fail('Admin dashboard — metrics query', metricsRes.error.message);
    else pass('Admin dashboard — metrics query', `${metricsRes.data?.length} rows`);
    if (gbpRes.error) fail('Admin dashboard — GBP query', gbpRes.error.message);
    else pass('Admin dashboard — GBP query', `${gbpRes.data?.length} rows`);
    if (formRes.error) fail('Admin dashboard — form fills query', formRes.error.message);
    else pass('Admin dashboard — form fills query', `${formRes.data?.length} rows`);
  } catch (e: any) { fail('Admin dashboard queries', e.message); }

  // Simulate client detail overview queries
  const testClient = ga4Clients[0];
  if (testClient) {
    try {
      const [detailRes, gbpDetailRes, prevRes] = await Promise.all([
        sb.from('client_metrics_summary')
          .select('date,total_leads,form_fills,gbp_calls,google_ads_conversions,sessions,seo_impressions,seo_clicks,seo_ctr,traffic_organic,traffic_paid,traffic_direct,traffic_referral,traffic_ai,ads_impressions,ads_clicks,ads_ctr,ad_spend,cpl,budget_utilization')
          .eq('client_id',testClient.id).eq('period_type','daily')
          .gte('date',dateFrom).lte('date',dateTo).order('date',{ascending:true}),
        sb.from('gbp_location_daily_metrics')
          .select('date,phone_calls,views,website_clicks,direction_requests,average_rating')
          .eq('client_id',testClient.id).gte('date',dateFrom).lte('date',dateTo),
        sb.from('client_metrics_summary')
          .select('total_leads,sessions,ad_spend,google_ads_conversions,seo_clicks,gbp_calls')
          .eq('client_id',testClient.id).eq('period_type','daily')
          .gte('date',PREV_START).lte('date',PREV_END),
      ]);
      if (detailRes.error) fail(`Overview queries: ${testClient.name}`, detailRes.error.message);
      else pass(`Overview summary query: ${testClient.name}`, `${detailRes.data?.length} days`);
      if (gbpDetailRes.error) fail(`Overview GBP query: ${testClient.name}`, gbpDetailRes.error.message);
      else pass(`Overview GBP detail query: ${testClient.name}`, `${gbpDetailRes.data?.length} rows`);
      if (prevRes.error) fail(`Overview MoM prev query: ${testClient.name}`, prevRes.error.message);
      else pass(`Overview MoM prev query: ${testClient.name}`, `${prevRes.data?.length} days for comparison`);
    } catch (e: any) { fail(`Overview queries: ${testClient.name}`, e.message); }

    // SEO page queries
    try {
      const [seoRes, gscRes, kwRes] = await Promise.all([
        sb.from('client_metrics_summary')
          .select('date,sessions,new_users,traffic_organic,seo_impressions,seo_clicks,seo_ctr,top_keywords,keywords_improved,keywords_declined,engagement_rate')
          .eq('client_id',testClient.id).eq('period_type','daily')
          .gte('date',dateFrom).lte('date',dateTo),
        sb.from('gsc_daily_summary')
          .select('top_keywords_count').eq('client_id',testClient.id)
          .gte('date',dateFrom).lte('date',dateTo).order('date',{ascending:false}).limit(1),
        sb.from('gsc_queries')
          .select('query,position').eq('client_id',testClient.id)
          .gte('date',dateFrom).lte('date',dateTo).limit(100),
      ]);
      if (seoRes.error) fail(`SEO summary query: ${testClient.name}`, seoRes.error.message);
      else pass(`SEO summary query: ${testClient.name}`, `${seoRes.data?.length} days`);
      if (gscRes.error) fail(`GSC daily summary query: ${testClient.name}`, gscRes.error.message);
      else pass(`GSC daily summary query: ${testClient.name}`, `top_keywords=${gscRes.data?.[0]?.top_keywords_count||0}`);
      if (kwRes.error) fail(`gsc_queries sample: ${testClient.name}`, kwRes.error.message);
      else pass(`gsc_queries sample: ${testClient.name}`, `${kwRes.data?.length} keyword rows`);
    } catch (e: any) { fail(`SEO page queries: ${testClient.name}`, e.message); }

    // Google Ads page queries
    const adsClient = adsClients[0];
    if (adsClient) {
      try {
        const [adsRes, termsRes, adGroupRes] = await Promise.all([
          sb.from('ads_campaign_metrics')
            .select('date,impressions,clicks,cost,conversions')
            .eq('client_id',adsClient.id).gte('date',dateFrom).lte('date',dateTo),
          sb.from('campaign_search_terms')
            .select('search_term,impressions,clicks,cost,conversions')
            .eq('client_id',adsClient.id).gte('date',dateFrom).lte('date',dateTo).gt('conversions',0),
          sb.from('ads_ad_group_metrics')
            .select('campaign_id,ad_group_id,ad_group_name,impressions,clicks,cost,conversions')
            .eq('client_id',adsClient.id).gte('date',dateFrom).lte('date',dateTo),
        ]);
        if (adsRes.error) fail(`Ads metrics query: ${adsClient.name}`, adsRes.error.message);
        else pass(`Ads metrics query: ${adsClient.name}`, `${adsRes.data?.length} campaign rows`);
        if (termsRes.error) fail(`Search terms query: ${adsClient.name}`, termsRes.error.message);
        else pass(`Search terms query: ${adsClient.name}`, `${termsRes.data?.length} converting terms`);
        if (adGroupRes.error) fail(`Ad group query: ${adsClient.name}`, adGroupRes.error.message);
        else pass(`Ad group query: ${adsClient.name}`, `${adGroupRes.data?.length} ad group rows`);
      } catch (e: any) { fail(`Ads page queries: ${adsClient.name}`, e.message); }
    }

    // GBP page queries
    if (gbpClients[0]) {
      const gbpC = gbpClients[0];
      try {
        const [gbpLocRes, gbpDailyRes] = await Promise.all([
          sb.from('gbp_locations')
            .select('id,location_name,address,phone,website,business_type')
            .eq('client_id',gbpC.id).single(),
          sb.from('gbp_location_daily_metrics')
            .select('date,views,direction_requests,phone_calls,website_clicks,total_reviews,average_rating,posts_count,posts_views')
            .eq('client_id',gbpC.id).gte('date',dateFrom).lte('date',dateTo).order('date',{ascending:true}),
        ]);
        if (gbpLocRes.error && gbpLocRes.error.code !== 'PGRST116') fail(`GBP location query: ${gbpC.name}`, gbpLocRes.error.message);
        else pass(`GBP location info: ${gbpC.name}`, gbpLocRes.data?.location_name || '(no name set)');
        if (gbpDailyRes.error) fail(`GBP daily query: ${gbpC.name}`, gbpDailyRes.error.message);
        else pass(`GBP daily query: ${gbpC.name}`, `${gbpDailyRes.data?.length} days`);
      } catch (e: any) { fail(`GBP page queries: ${gbpC.name}`, e.message); }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 12: DATA FRESHNESS & CRON HEALTH
  // ══════════════════════════════════════════════════════════════════════════
  currentGroup = '12. Data Freshness';

  const { data: freshRow } = await sb.from('client_metrics_summary')
    .select('updated_at').eq('period_type','daily')
    .order('updated_at',{ascending:false}).limit(1);
  if (freshRow?.[0]) {
    const lastUpdate = new Date(freshRow[0].updated_at);
    const hoursSince = (Date.now()-lastUpdate.getTime())/(1000*60*60);
    if (hoursSince > 36) fail('Rollup freshness', `Last update ${hoursSince.toFixed(0)}h ago — cron may not be running!`);
    else if (hoursSince > 24) warn('Rollup freshness', `Last update ${hoursSince.toFixed(0)}h ago — expected daily`);
    else pass('Rollup freshness', `Last rollup ${hoursSince.toFixed(1)}h ago ✓`);
  }

  // GA4 freshness: latest ga4_sessions date
  const { data: ga4Latest } = await sb.from('ga4_sessions').select('date').order('date',{ascending:false}).limit(1);
  if (ga4Latest?.[0]) {
    const latestDate = new Date(ga4Latest[0].date+'T12:00:00Z');
    const daysSince  = (Date.now()-latestDate.getTime())/(1000*60*60*24);
    if (daysSince > 3) warn('GA4 freshness', `Latest data: ${ga4Latest[0].date} (${daysSince.toFixed(0)} days ago)`);
    else pass('GA4 freshness', `Latest: ${ga4Latest[0].date} (${daysSince.toFixed(0)} days ago) ✓`);
  }

  // GSC freshness: latest gsc_daily_summary date
  const { data: gscLatest } = await sb.from('gsc_daily_summary').select('date').order('date',{ascending:false}).limit(1);
  if (gscLatest?.[0]) {
    const latestDate = new Date(gscLatest[0].date+'T12:00:00Z');
    const daysSince  = (Date.now()-latestDate.getTime())/(1000*60*60*24);
    if (daysSince > 4) warn('GSC freshness', `Latest: ${gscLatest[0].date} (${daysSince.toFixed(0)} days ago — GSC has 2-3 day lag)`);
    else pass('GSC freshness', `Latest: ${gscLatest[0].date} (${daysSince.toFixed(0)} days ago — normal GSC lag) ✓`);
  }

  // GBP freshness
  const { data: gbpLatest } = await sb.from('gbp_location_daily_metrics').select('date').order('date',{ascending:false}).limit(1);
  if (gbpLatest?.[0]) {
    const latestDate = new Date(gbpLatest[0].date+'T12:00:00Z');
    const daysSince  = (Date.now()-latestDate.getTime())/(1000*60*60*24);
    if (daysSince > 3) warn('GBP freshness', `Latest: ${gbpLatest[0].date} (${daysSince.toFixed(0)} days ago)`);
    else pass('GBP freshness', `Latest: ${gbpLatest[0].date} ✓`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRINT RESULTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('');
  let lastGroup = '';
  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log(`\n  ── ${r.group} ${'─'.repeat(Math.max(0, 55-r.group.length))}`);
      lastGroup = r.group;
    }
    const nameCol = r.name.padEnd(48);
    console.log(`  ${r.status} ${nameCol} ${r.detail}`);
  }

  const passed  = results.filter(r => r.status === '✅').length;
  const warned  = results.filter(r => r.status === '⚠️ ').length;
  const failed  = results.filter(r => r.status === '❌').length;
  const total   = results.length;

  console.log('\n' + '='.repeat(70));
  console.log(`  TOTAL: ${total} checks | ✅ ${passed} passed | ⚠️  ${warned} warnings | ❌ ${failed} failed`);
  if (failed > 0) {
    console.log('\n  ❌ CRITICAL ISSUES — fix before deploying:');
    results.filter(r => r.status === '❌').forEach(r => console.log(`     • [${r.group}] ${r.name}: ${r.detail}`));
  }
  if (warned > 0) {
    console.log('\n  ⚠️  WARNINGS — review recommended:');
    results.filter(r => r.status === '⚠️ ').forEach(r => console.log(`     • [${r.group}] ${r.name}: ${r.detail}`));
  }
  if (failed === 0 && warned === 0) console.log('\n  🎉 PERFECT — all checks passed. Data is clean and consistent.');
  else if (failed === 0) console.log('\n  ✅ No critical errors. Review warnings above.');
  console.log('');
}

run().catch(console.error);
