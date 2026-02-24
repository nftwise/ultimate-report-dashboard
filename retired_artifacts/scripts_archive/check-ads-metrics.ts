import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdsMetrics() {
  // Get Chiropractic First client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%chiropractic first%');

  if (clientError || !clients || clients.length === 0) {
    console.error('Chiropractic First not found');
    return;
  }

  const chiroId = clients[0].id;
  console.log(`\nFound: ${clients[0].name} (ID: ${chiroId})\n`);

  // Check client_metrics_summary for Ads metrics in Dec 2025
  const { data: metricsData, error: metricsError } = await supabase
    .from('client_metrics_summary')
    .select('date, google_ads_conversions, cpl')
    .eq('client_id', chiroId)
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-31')
    .order('date', { ascending: false });

  if (metricsError) {
    console.error('Error fetching metrics:', metricsError);
    return;
  }

  console.log('Google Ads metrics from client_metrics_summary (Dec 2025):');
  console.log('='.repeat(70));

  let totalConversions = 0;
  let cplValues: number[] = [];
  let nonZeroCplCount = 0;

  (metricsData || []).forEach((metric: any) => {
    const conv = metric.google_ads_conversions || 0;
    const cpl = metric.cpl || 0;
    totalConversions += conv;
    if (cpl > 0) {
      cplValues.push(cpl);
      nonZeroCplCount++;
    }
    console.log(`${metric.date}: conversions=${conv}, cpl=${cpl}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\nSummary for Dec 2025:`);
  console.log(`Total Conversions: ${totalConversions}`);
  console.log(`CPL values found: ${nonZeroCplCount} (out of ${metricsData?.length || 0} days)`);

  if (cplValues.length > 0) {
    const avgCpl = cplValues.reduce((a, b) => a + b, 0) / cplValues.length;
    console.log(`Average CPL: $${avgCpl.toFixed(2)}`);
    console.log(`Min CPL: $${Math.min(...cplValues).toFixed(2)}`);
    console.log(`Max CPL: $${Math.max(...cplValues).toFixed(2)}`);
  } else {
    console.log(`⚠️  No CPL values found (all zeros or null)`);
  }

  // Also check if there are Google Ads events in ga4_events
  console.log('\n' + '='.repeat(70));
  console.log('\nChecking ga4_events for Google Ads conversion events:');
  const { data: adsEvents } = await supabase
    .from('ga4_events')
    .select('event_name')
    .eq('client_id', chiroId)
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-31');

  const uniqueEventNames = new Set<string>();
  (adsEvents || []).forEach((event: any) => {
    if (event.event_name) {
      uniqueEventNames.add(event.event_name);
    }
  });

  if (uniqueEventNames.size > 0) {
    console.log(`Events found: ${Array.from(uniqueEventNames).join(', ')}`);
  } else {
    console.log(`No GA4 events found for this client in Dec 2025`);
  }
}

checkAdsMetrics().catch(console.error);
