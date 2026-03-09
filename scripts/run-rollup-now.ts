#!/usr/bin/env npx tsx
/**
 * Manual rollup trigger — runs the same aggregation as the Vercel cron.
 * Usage: npx tsx scripts/run-rollup-now.ts [date?]
 *
 * Calls the local run-rollup logic by importing directly from the route module
 * via a thin wrapper that calls Supabase directly.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH_SIZE = 5;

async function getDateRange(): Promise<string[]> {
  const specificDate = process.argv[2];
  if (specificDate) return [specificDate];

  const now = new Date();
  const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const dates: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const d = new Date(caToday);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, slug, has_seo, has_ads')
    .eq('is_active', true);
  if (error) throw new Error(`Failed to fetch clients: ${error.message}`);
  return data || [];
}

async function rollupDate(clientId: string, date: string) {
  // Fetch GA4 sessions
  const { data: ga4 } = await supabase
    .from('ga4_sessions')
    .select('sessions, new_users')
    .eq('client_id', clientId)
    .eq('date', date);

  const sessions = (ga4 || []).reduce((s, r) => s + (r.sessions || 0), 0);
  const new_users = (ga4 || []).reduce((s, r) => s + (r.new_users || 0), 0);

  // Fetch GA4 form fills (events with "success" in name)
  const { data: events } = await supabase
    .from('ga4_events')
    .select('event_count')
    .eq('client_id', clientId)
    .eq('date', date)
    .ilike('event_name', '%success%');

  const form_fills = (events || []).reduce((s, r) => s + (r.event_count || 0), 0);

  // Fetch GSC
  const { data: gsc } = await supabase
    .from('gsc_queries')
    .select('impressions, clicks')
    .eq('client_id', clientId)
    .eq('date', date);

  const seo_impressions = (gsc || []).reduce((s, r) => s + (r.impressions || 0), 0);
  const seo_clicks = (gsc || []).reduce((s, r) => s + (r.clicks || 0), 0);

  // Fetch Ads campaigns
  const { data: ads } = await supabase
    .from('ads_campaign_metrics')
    .select('cost, impressions, clicks, conversions')
    .eq('client_id', clientId)
    .eq('date', date);

  const ad_spend = (ads || []).reduce((s, r) => s + (r.cost || 0), 0);
  const ads_impressions = (ads || []).reduce((s, r) => s + (r.impressions || 0), 0);
  const ads_clicks = (ads || []).reduce((s, r) => s + (r.clicks || 0), 0);
  const google_ads_conversions = (ads || []).reduce((s, r) => s + (r.conversions || 0), 0);
  const cpl = google_ads_conversions > 0 ? ad_spend / google_ads_conversions : 0;

  // Fetch GBP from raw table
  const { data: gbp } = await supabase
    .from('gbp_location_daily_metrics')
    .select('phone_calls, website_clicks, direction_requests, views')
    .eq('client_id', clientId)
    .eq('date', date);

  const gbp_calls = (gbp || []).reduce((s, r) => s + (r.phone_calls || 0), 0);
  const gbp_website_clicks = (gbp || []).reduce((s, r) => s + (r.website_clicks || 0), 0);
  const gbp_directions = (gbp || []).reduce((s, r) => s + (r.direction_requests || 0), 0);
  const gbp_profile_views = (gbp || []).reduce((s, r) => s + (r.views || 0), 0);

  const total_leads = form_fills + google_ads_conversions + gbp_calls;

  const row = {
    client_id: clientId,
    date,
    period_type: 'daily',
    sessions,
    new_users,
    form_fills,
    seo_impressions,
    seo_clicks,
    ad_spend,
    ads_impressions,
    ads_clicks,
    google_ads_conversions,
    cpl,
    gbp_calls,
    gbp_website_clicks,
    gbp_directions,
    gbp_profile_views,
    total_leads,
  };

  const { error } = await supabase
    .from('client_metrics_summary')
    .upsert(row, { onConflict: 'client_id,date,period_type' });

  return error ? 0 : 1;
}

async function main() {
  console.log('[rollup] Starting manual rollup...');
  const startTime = Date.now();

  const [dates, clients] = await Promise.all([getDateRange(), getClients()]);
  console.log(`[rollup] ${dates.length} dates × ${clients.length} clients = ${dates.length * clients.length} rows`);
  console.log(`[rollup] Date range: ${dates[dates.length - 1]} → ${dates[0]}`);

  let total = 0;
  let errors = 0;

  for (const date of dates) {
    process.stdout.write(`[rollup] ${date}: `);
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(c => rollupDate(c.id, date).catch(() => 0)));
      const ok = results.reduce((s, r) => s + r, 0);
      total += ok;
      errors += (results.length - ok);
      process.stdout.write(`${ok}`);
    }
    process.stdout.write('\n');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[rollup] Done in ${duration}s: ${total} ok, ${errors} errors`);
}

main().catch(err => {
  console.error('[rollup] Fatal:', err);
  process.exit(1);
});
