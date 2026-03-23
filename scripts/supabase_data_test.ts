/**
 * Full Supabase data connectivity & integrity test
 * Tests every table/column combination used in the dashboard
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type TestResult = { name: string; status: '✅' | '⚠️ ' | '❌'; detail: string };
const results: TestResult[] = [];

function pass(name: string, detail: string) { results.push({ name, status: '✅', detail }); }
function warn(name: string, detail: string) { results.push({ name, status: '⚠️ ', detail }); }
function fail(name: string, detail: string) { results.push({ name, status: '❌', detail }); }

const TODAY = '2026-02-28';
const MONTH_START = '2026-02-01';

async function run() {
  console.log('\n🔍 WiseCRM — Supabase Data Connectivity & Integrity Test');
  console.log('='.repeat(65));

  // ── 1. clients table ─────────────────────────────────────────────
  try {
    const { data, error } = await sb.from('clients')
      .select('id, name, slug, is_active, city')
      .eq('is_active', true);
    if (error) fail('clients table', error.message);
    else if (!data || data.length === 0) fail('clients table', 'No active clients found!');
    else {
      const noSlug = data.filter(c => !c.slug).length;
      const noName = data.filter(c => !c.name).length;
      const noCity = data.filter(c => !c.city).length;
      if (noSlug > 0) warn('clients — slug', `${noSlug} clients have no slug (breaks routing)`);
      else pass('clients — slug', 'All clients have slugs');
      if (noName > 0) warn('clients — name', `${noName} clients have no name`);
      else pass('clients — name', `${data.length} active clients`);
      if (noCity > 5) warn('clients — city', `${noCity}/${data.length} clients missing city`);
      else pass('clients — city', `${data.length - noCity}/${data.length} have city`);
    }
  } catch (e: any) { fail('clients table', e.message); }

  // ── 2. service_configs table ──────────────────────────────────────
  try {
    const { data, error } = await sb.from('service_configs')
      .select('client_id, ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id');
    if (error) fail('service_configs', error.message);
    else {
      const total = data?.length || 0;
      const noGA4 = (data || []).filter(c => !c.ga_property_id?.trim()).length;
      const noAds = (data || []).filter(c => !c.gads_customer_id?.trim()).length;
      const noGSC = (data || []).filter(c => !c.gsc_site_url?.trim()).length;
      const noGBP = (data || []).filter(c => !c.gbp_location_id?.trim()).length;
      pass('service_configs', `${total} rows`);
      if (noGA4 > 0) warn('service_configs — ga_property_id', `${noGA4} clients unconfigured`);
      else pass('service_configs — ga_property_id', 'All configured');
      if (noAds > 0) warn('service_configs — gads_customer_id', `${noAds} clients unconfigured`);
      else pass('service_configs — gads_customer_id', 'All configured');
      if (noGSC > 0) warn('service_configs — gsc_site_url', `${noGSC} clients unconfigured`);
      if (noGBP > 0) warn('service_configs — gbp_location_id', `${noGBP} clients unconfigured`);
    }
  } catch (e: any) { fail('service_configs', e.message); }

  // ── 3. client_metrics_summary — schema & data ─────────────────────
  const summaryColumns = [
    'client_id','date','period_type','sessions','new_users','form_fills',
    'top_keywords','seo_impressions','seo_clicks','seo_ctr',
    'traffic_organic','traffic_paid','traffic_direct','traffic_referral','traffic_ai',
    'ad_spend','ads_impressions','ads_clicks','google_ads_conversions','cpl',
    'gbp_calls','gbp_website_clicks','gbp_directions','gbp_profile_views',
    'total_leads','updated_at',
  ];
  try {
    const { data, error } = await sb.from('client_metrics_summary')
      .select(summaryColumns.join(','))
      .eq('period_type', 'daily')
      .eq('date', TODAY)
      .limit(5);
    if (error) fail('client_metrics_summary schema', error.message);
    else {
      pass('client_metrics_summary schema', `All ${summaryColumns.length} columns present`);
      if (!data || data.length === 0) warn('client_metrics_summary data', `No rows for ${TODAY}`);
      else {
        const withSessions = data.filter(r => (r.sessions || 0) > 0).length;
        const withSpend = data.filter(r => (r.ad_spend || 0) > 0).length;
        pass('client_metrics_summary data', `${data.length} rows for ${TODAY}, sessions>0: ${withSessions}, spend>0: ${withSpend}`);
      }
    }
  } catch (e: any) { fail('client_metrics_summary', e.message); }

  // Check monthly row count for Feb 2026
  try {
    const { count } = await sb.from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .eq('period_type', 'daily')
      .gte('date', MONTH_START).lte('date', TODAY);
    if ((count || 0) < 100) warn('client_metrics_summary Feb 2026', `Only ${count} rows — expected 18×28=504`);
    else pass('client_metrics_summary Feb 2026', `${count} rows (expected ~504)`);
  } catch (e: any) { fail('client_metrics_summary count', e.message); }

  // ── 4. ga4_sessions ───────────────────────────────────────────────
  try {
    const { data, error } = await sb.from('ga4_sessions')
      .select('client_id,date,sessions,new_users,source_medium,engagement_rate')
      .eq('date', TODAY).gt('sessions', 0);
    if (error) fail('ga4_sessions', error.message);
    else {
      const unique = new Set((data || []).map(r => r.client_id)).size;
      if (unique < 10) warn('ga4_sessions', `Only ${unique} clients with data on ${TODAY}`);
      else pass('ga4_sessions', `${unique} clients with sessions on ${TODAY}, ${data?.length} rows`);
    }
  } catch (e: any) { fail('ga4_sessions', e.message); }

  // ── 5. ga4_events ─────────────────────────────────────────────────
  try {
    const { count, error } = await sb.from('ga4_events')
      .select('*', { count: 'exact', head: true })
      .gte('date', MONTH_START).lte('date', TODAY)
      .ilike('event_name', '%success%');
    if (error) fail('ga4_events (success events)', error.message);
    else pass('ga4_events — success events', `${count} rows Feb 2026`);
  } catch (e: any) { fail('ga4_events', e.message); }

  // ── 6. ads_campaign_metrics ────────────────────────────────────────
  try {
    const { data, error } = await sb.from('ads_campaign_metrics')
      .select('client_id,date,cost,impressions,clicks,conversions')
      .eq('date', TODAY);
    if (error) fail('ads_campaign_metrics', error.message);
    else {
      const unique = new Set((data || []).map(r => r.client_id)).size;
      const totalSpend = (data || []).reduce((s, r) => s + parseFloat(r.cost || 0), 0);
      if (unique === 0) warn('ads_campaign_metrics', `No ad data for ${TODAY}`);
      else pass('ads_campaign_metrics', `${unique} clients, $${totalSpend.toFixed(2)} total spend on ${TODAY}`);
    }
  } catch (e: any) { fail('ads_campaign_metrics', e.message); }

  // Check for negative costs or impossible conversions
  try {
    const { data } = await sb.from('ads_campaign_metrics')
      .select('client_id,date,cost,conversions')
      .gte('date', MONTH_START).lte('date', TODAY)
      .lt('cost', 0);
    if ((data?.length || 0) > 0) fail('ads_campaign_metrics — negative cost', `${data?.length} rows with cost < 0!`);
    else pass('ads_campaign_metrics — cost sanity', 'No negative costs found');
  } catch (e: any) { fail('ads cost sanity', e.message); }

  // ── 7. gsc_daily_summary ──────────────────────────────────────────
  try {
    const { data, error } = await sb.from('gsc_daily_summary')
      .select('client_id,date,total_impressions,total_clicks,top_keywords_count')
      .eq('date', TODAY);
    if (error) fail('gsc_daily_summary', error.message);
    else {
      const unique = new Set((data || []).map(r => r.client_id)).size;
      if (unique < 5) warn('gsc_daily_summary', `Only ${unique} clients on ${TODAY}`);
      else pass('gsc_daily_summary', `${unique} clients on ${TODAY}`);
    }
  } catch (e: any) { fail('gsc_daily_summary', e.message); }

  // ── 8. gbp_location_daily_metrics ────────────────────────────────
  try {
    const { data, error } = await sb.from('gbp_location_daily_metrics')
      .select('client_id,date,phone_calls,views,website_clicks,direction_requests')
      .eq('date', TODAY);
    if (error) fail('gbp_location_daily_metrics', error.message);
    else {
      const unique = new Set((data || []).map(r => r.client_id)).size;
      if (unique < 5) warn('gbp_location_daily_metrics', `Only ${unique} clients on ${TODAY}`);
      else pass('gbp_location_daily_metrics', `${unique} clients on ${TODAY}`);
    }
  } catch (e: any) { fail('gbp_location_daily_metrics', e.message); }

  // ── 9. gbp_locations (cron reads this) ───────────────────────────
  try {
    const { data, error } = await sb.from('gbp_locations').select('client_id,gbp_location_id,is_active');
    if (error) fail('gbp_locations', error.message);
    else {
      const active = (data || []).filter(r => r.is_active).length;
      pass('gbp_locations', `${active} active GBP locations`);
    }
  } catch (e: any) { fail('gbp_locations', e.message); }

  // ── 10. gsc_queries ──────────────────────────────────────────────
  try {
    const { count, error } = await sb.from('gsc_queries')
      .select('*', { count: 'exact', head: true })
      .gte('date', MONTH_START).lte('date', TODAY);
    if (error) fail('gsc_queries', error.message);
    else if ((count || 0) < 100) warn('gsc_queries', `Only ${count} rows Feb 2026`);
    else pass('gsc_queries', `${count} keyword rows Feb 2026`);
  } catch (e: any) { fail('gsc_queries', e.message); }

  // ── 11. ga4_landing_pages ─────────────────────────────────────────
  try {
    const { count, error } = await sb.from('ga4_landing_pages')
      .select('*', { count: 'exact', head: true })
      .gte('date', MONTH_START).lte('date', TODAY);
    if (error) fail('ga4_landing_pages', error.message);
    else pass('ga4_landing_pages', `${count} rows Feb 2026`);
  } catch (e: any) { fail('ga4_landing_pages', e.message); }

  // ── 12. users table ──────────────────────────────────────────────
  try {
    const { data, error } = await sb.from('users').select('id,email,role').eq('is_active', true);
    if (error) fail('users table', error.message);
    else {
      const admins = (data || []).filter(u => u.role === 'admin').length;
      const clients = (data || []).filter(u => u.role === 'client').length;
      const team = (data || []).filter(u => u.role === 'team').length;
      pass('users table', `${data?.length} active users (admin:${admins} team:${team} client:${clients})`);
      if (admins === 0) fail('users — admin', 'No admin users! Login will fail.');
    }
  } catch (e: any) { fail('users table', e.message); }

  // ── 13. Data freshness check ──────────────────────────────────────
  try {
    const { data } = await sb.from('client_metrics_summary')
      .select('updated_at').eq('period_type', 'daily')
      .order('updated_at', { ascending: false }).limit(1);
    if (data && data[0]) {
      const lastUpdate = new Date(data[0].updated_at);
      const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSince > 48) warn('data freshness', `Last rollup: ${lastUpdate.toISOString()} (${hoursSince.toFixed(0)}h ago)`);
      else pass('data freshness', `Last rollup: ${lastUpdate.toISOString()} (${hoursSince.toFixed(1)}h ago)`);
    }
  } catch (e: any) { fail('data freshness', e.message); }

  // ── 14. CPL sanity: no client with 0 spend but conversions > 0 ──
  try {
    const { data } = await sb.from('client_metrics_summary')
      .select('client_id,date,ad_spend,google_ads_conversions')
      .eq('period_type', 'daily')
      .gte('date', MONTH_START).lte('date', TODAY)
      .eq('ad_spend', 0)
      .gt('google_ads_conversions', 0);
    if ((data?.length || 0) > 0) warn('CPL sanity', `${data?.length} rows: conversions > 0 but spend = 0 (stale rollup?)`);
    else pass('CPL sanity', 'No impossible CPL rows (spend=0, conv>0)');
  } catch (e: any) { fail('CPL sanity', e.message); }

  // ── 15. Rollup coverage: all active clients have Feb summary rows
  try {
    const { data: clients } = await sb.from('clients').select('id,name').eq('is_active', true);
    const clientIds = (clients || []).map(c => c.id);
    const { data: summaryClients } = await sb.from('client_metrics_summary')
      .select('client_id')
      .eq('period_type', 'daily')
      .gte('date', MONTH_START).lte('date', TODAY);
    const inSummary = new Set((summaryClients || []).map(r => r.client_id));
    const missing = (clients || []).filter(c => !inSummary.has(c.id)).map(c => c.name);
    if (missing.length > 0) warn('rollup coverage', `Missing from Feb summary: ${missing.join(', ')}`);
    else pass('rollup coverage', `All ${clientIds.length} active clients have Feb 2026 summary rows`);
  } catch (e: any) { fail('rollup coverage', e.message); }

  // ── PRINT RESULTS ─────────────────────────────────────────────────
  console.log('');
  const maxLen = Math.max(...results.map(r => r.name.length));
  for (const r of results) {
    console.log(`  ${r.status} ${r.name.padEnd(maxLen + 2)} ${r.detail}`);
  }

  const passed = results.filter(r => r.status === '✅').length;
  const warned = results.filter(r => r.status === '⚠️ ').length;
  const failed = results.filter(r => r.status === '❌').length;

  console.log('\n' + '='.repeat(65));
  console.log(`  Results: ${passed} passed  ${warned} warnings  ${failed} failed`);
  if (failed > 0) console.log('\n  ❌ ACTION REQUIRED — see failed checks above');
  else if (warned > 0) console.log('\n  ⚠️  Review warnings — data may be incomplete');
  else console.log('\n  🎉 All checks passed — Supabase data looks healthy!');
  console.log('');
}

run();
