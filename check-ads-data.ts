import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdsData() {
  // Get Dr DiGrado and DeCarlo Chiropractic
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select(`id, name, service_configs(gads_customer_id)`)
    .in('name', ['DR DIGRADO', 'DR DIGRADO CHIROPRACTIC', 'DeCarlo Chiropractic', 'DECARLO CHIROPRACTIC']);

  if (clientError) {
    console.error('Error fetching clients:', clientError);
    return;
  }

  console.log('\n='.repeat(70));
  console.log('Checking Ads data for clients with Google Ads service\n');

  for (const client of clients || []) {
    const config = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs;

    const hasGoogleAds = !!(config?.gads_customer_id);

    console.log(`\nClient: ${client.name}`);
    console.log(`  Has Google Ads: ${hasGoogleAds ? '✓' : '✗'}`);
    if (config?.gads_customer_id) {
      console.log(`  Ads Customer ID: ${config.gads_customer_id}`);
    }

    // Check metrics for Dec 2025
    const { data: metricsData } = await supabase
      .from('client_metrics_summary')
      .select('date, google_ads_conversions, cpl, ad_spend, ads_clicks, ads_impressions, conversion_rate')
      .eq('client_id', client.id)
      .gte('date', '2025-12-01')
      .lte('date', '2025-12-31')
      .order('date', { ascending: false })
      .limit(5);

    if (metricsData && metricsData.length > 0) {
      console.log(`  Metrics (latest 5 days):`);
      metricsData.forEach((metric: any) => {
        console.log(`    ${metric.date}:`);
        console.log(`      - conversions: ${metric.google_ads_conversions}`);
        console.log(`      - cpl: ${metric.cpl}`);
        console.log(`      - ad_spend: ${metric.ad_spend}`);
        console.log(`      - clicks: ${metric.ads_clicks}`);
        console.log(`      - impressions: ${metric.ads_impressions}`);
        console.log(`      - conversion_rate: ${metric.conversion_rate}`);
      });
    } else {
      console.log(`  ⚠️  No metrics data for Dec 2025`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

checkAdsData().catch(console.error);
