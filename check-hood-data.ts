import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHoodData() {
  // Get HOOD CHIROPRACTIC
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, service_configs(*)')
    .ilike('name', '%HOOD CHIROPRACTIC%');

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.error('HOOD CHIROPRACTIC not found');
    return;
  }

  const client = clients[0];
  const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;

  console.log('\n' + '='.repeat(80));
  console.log('HOOD CHIROPRACTIC - Complete Data Audit');
  console.log('='.repeat(80));

  console.log(`\nClient ID: ${client.id}`);
  console.log(`Client Name: ${client.name}`);

  console.log('\n--- Service Configuration ---');
  console.log(`GA Property ID: ${config?.ga_property_id || 'NOT CONFIGURED'}`);
  console.log(`GSC Site URL: ${config?.gsc_site_url || 'NOT CONFIGURED'}`);
  console.log(`GBP Location ID: ${config?.gbp_location_id || 'NOT CONFIGURED'}`);
  console.log(`Google Ads Customer ID: ${config?.gads_customer_id || 'NOT CONFIGURED'}`);
  console.log(`CallRail Account ID: ${config?.callrail_account_id || 'NOT CONFIGURED'}`);

  // Check GA4 events
  console.log('\n--- GA4 Events ---');
  const { data: allEvents } = await supabase
    .from('ga4_events')
    .select('event_name, date, event_count')
    .eq('client_id', client.id)
    .order('date', { ascending: false });

  if (allEvents && allEvents.length > 0) {
    const eventNames = new Set<string>();
    const dateRange = new Set<string>();
    let totalEventCount = 0;

    allEvents.forEach((event: any) => {
      eventNames.add(event.event_name);
      dateRange.add(event.date);
      totalEventCount += event.event_count || 1;
    });

    console.log(`Total event records: ${allEvents.length}`);
    console.log(`Unique event names: ${eventNames.size}`);
    console.log(`Date range: ${Array.from(dateRange).sort().reverse().slice(0, 2).join(' to ')}`);
    console.log(`\nEvent types:`);
    Array.from(eventNames).sort().forEach(name => {
      const count = allEvents
        .filter(e => e.event_name === name)
        .reduce((sum, e) => sum + (e.event_count || 1), 0);
      console.log(`  - ${name}: ${count}`);
    });
  } else {
    console.log('⚠️  NO GA4 events found');
  }

  // Check metrics summary
  console.log('\n--- Metrics Summary Data ---');
  const { data: metricsData } = await supabase
    .from('client_metrics_summary')
    .select('date, total_leads, form_fills, google_ads_conversions, cpl, ad_spend, gbp_calls')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(31); // Last month

  if (metricsData && metricsData.length > 0) {
    console.log(`Total metric records: ${metricsData.length}`);

    // Count non-zero values
    let hasLeads = 0, hasForms = 0, hasAdsConv = 0, hasCpl = 0, hasSpend = 0, hasGbpCalls = 0;

    metricsData.forEach((metric: any) => {
      if (metric.total_leads > 0) hasLeads++;
      if (metric.form_fills > 0) hasForms++;
      if (metric.google_ads_conversions > 0) hasAdsConv++;
      if (metric.cpl > 0) hasCpl++;
      if (metric.ad_spend > 0) hasSpend++;
      if (metric.gbp_calls > 0) hasGbpCalls++;
    });

    console.log(`\nData populated in records:`);
    console.log(`  - Total Leads: ${hasLeads}/${metricsData.length} days`);
    console.log(`  - Form Fills: ${hasForms}/${metricsData.length} days`);
    console.log(`  - Ads Conversions: ${hasAdsConv}/${metricsData.length} days`);
    console.log(`  - CPL: ${hasCpl}/${metricsData.length} days`);
    console.log(`  - Ad Spend: ${hasSpend}/${metricsData.length} days`);
    console.log(`  - GBP Calls: ${hasGbpCalls}/${metricsData.length} days`);

    // Show sample records
    console.log(`\nLatest 5 records (Dec 2025):`);
    metricsData.slice(0, 5).forEach((metric: any) => {
      console.log(`  ${metric.date}:`);
      console.log(`    leads=${metric.total_leads}, forms=${metric.form_fills}, ads_conv=${metric.google_ads_conversions}, cpl=${metric.cpl}, spend=${metric.ad_spend}, gbp_calls=${metric.gbp_calls}`);
    });
  } else {
    console.log('⚠️  NO metrics data found');
  }

  // Check GBP metrics
  console.log('\n--- GBP Location Metrics ---');
  const { data: gbpData } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls, profile_views, website_clicks')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(31);

  if (gbpData && gbpData.length > 0) {
    console.log(`Total GBP records: ${gbpData.length}`);

    let hasCalls = 0, hasViews = 0, hasClicks = 0;
    gbpData.forEach((metric: any) => {
      if (metric.phone_calls > 0) hasCalls++;
      if (metric.profile_views > 0) hasViews++;
      if (metric.website_clicks > 0) hasClicks++;
    });

    console.log(`Data populated:`);
    console.log(`  - Phone Calls: ${hasCalls}/${gbpData.length} days`);
    console.log(`  - Profile Views: ${hasViews}/${gbpData.length} days`);
    console.log(`  - Website Clicks: ${hasClicks}/${gbpData.length} days`);
  } else {
    console.log('⚠️  NO GBP metrics found');
  }

  console.log('\n' + '='.repeat(80));
}

checkHoodData().catch(console.error);
