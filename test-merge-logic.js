const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testMergeLogic() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST: SIMULATE DASHBOARD MERGE LOGIC');
  console.log('='.repeat(80) + '\n');

  const clientId = 'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6'; // DeCarlo
  const dateFromISO = '2025-08-01';
  const dateToISO = '2025-08-31';

  // Step 1: Fetch metrics data (like dashboard does)
  console.log('Step 1: Fetch metrics data...');
  const { data: metricsData } = await supabase
    .from('client_metrics_summary')
    .select(`
      date,
      total_leads,
      form_fills,
      gbp_calls,
      google_ads_conversions,
      sessions,
      seo_impressions,
      seo_clicks,
      seo_ctr,
      traffic_organic,
      traffic_paid,
      traffic_direct,
      traffic_referral,
      traffic_ai,
      ads_impressions,
      ads_clicks,
      ads_ctr,
      ad_spend,
      cpl,
      health_score,
      budget_utilization
    `)
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .order('date', { ascending: true });

  console.log(`✅ Fetched ${metricsData?.length} metrics records\n`);

  // Step 2: Fetch GBP data (like dashboard does)
  console.log('Step 2: Fetch GBP data...');
  const { data: gbpData } = await supabase
    .from('gbp_location_daily_metrics')
    .select(`
      date,
      phone_calls,
      views,
      website_clicks,
      direction_requests
    `)
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .order('date', { ascending: true });

  console.log(`✅ Fetched ${gbpData?.length} GBP records\n`);

  // Step 3: Merge (exactly like dashboard does)
  console.log('Step 3: Merge GBP data into metrics...');
  const merged = (metricsData || []).map((metric) => {
    const gbp = gbpData?.find((g) => g.date === metric.date);
    return {
      ...metric,
      // Prefer location-level GBP data (more reliable) over client-level
      gbp_calls: gbp?.phone_calls || metric.gbp_calls || 0,
      gbp_profile_views: gbp?.views || 0,
      gbp_website_clicks: gbp?.website_clicks || 0,
      gbp_direction_requests: gbp?.direction_requests || 0
    };
  });

  console.log(`✅ Merged ${merged.length} records\n`);

  // Step 4: Calculate total (exactly like dashboard does)
  console.log('Step 4: Calculate totals (like dashboard line 238)...');
  const totalGbpCalls = merged.reduce((sum, d) => sum + (d.gbp_calls || 0), 0);
  const totalGbpWebsiteClicks = merged.reduce((sum, d) => sum + (d.gbp_website_clicks || 0), 0);
  const totalGbpDirections = merged.reduce((sum, d) => sum + (d.gbp_direction_requests || 0), 0);

  console.log(`   totalGbpCalls = ${totalGbpCalls}`);
  console.log(`   totalGbpWebsiteClicks = ${totalGbpWebsiteClicks}`);
  console.log(`   totalGbpDirections = ${totalGbpDirections}\n`);

  // Step 5: Show sample data
  console.log('Step 5: Sample merged records (first 5):');
  merged.slice(0, 5).forEach((record, i) => {
    console.log(`\n  Record ${i + 1}:`);
    console.log(`    date: ${record.date}`);
    console.log(`    gbp_calls (original): ${metricsData?.find(m => m.date === record.date)?.gbp_calls}`);
    console.log(`    gbp_calls (merged): ${record.gbp_calls}`);
    const gbpRaw = gbpData?.find(g => g.date === record.date);
    console.log(`    phone_calls (from GBP table): ${gbpRaw?.phone_calls || 'N/A'}`);
    console.log(`    website_clicks: ${record.gbp_website_clicks}`);
    console.log(`    direction_requests: ${record.gbp_direction_requests}`);
  });

  // Step 6: Check if any records have phone_calls but merged shows 0
  console.log('\n\nStep 6: Check for mismatch...');
  let mismatchCount = 0;
  merged.forEach((record, i) => {
    const gbpRaw = gbpData?.find(g => g.date === record.date);
    if (gbpRaw && gbpRaw.phone_calls > 0 && record.gbp_calls === 0) {
      console.log(`  ❌ Mismatch at ${record.date}:`);
      console.log(`     GBP phone_calls: ${gbpRaw.phone_calls}`);
      console.log(`     Merged gbp_calls: ${record.gbp_calls}`);
      mismatchCount++;
    }
  });

  if (mismatchCount === 0) {
    console.log('  ✅ No mismatches - merge logic is working correctly');
  } else {
    console.log(`  ⚠️ Found ${mismatchCount} mismatches!`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

testMergeLogic();
