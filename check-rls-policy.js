const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRLS() {
  console.log('\n' + '='.repeat(80));
  console.log('CHECK RLS POLICY - CAN ANON KEY READ GBP DATA?');
  console.log('='.repeat(80) + '\n');

  const clientId = 'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6';

  // Try to fetch GBP data with anon key (like browser does)
  console.log('Attempting to fetch GBP data with anon key...\n');

  const { data, error, status } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);

  if (error) {
    console.log('❌ ERROR fetching GBP data:');
    console.log(`   Status: ${status}`);
    console.log(`   Message: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    console.log('\n⚠️ This is a RLS policy issue - anon key cannot read this table');
  } else if (data && data.length === 0) {
    console.log('✅ Query succeeded but no data returned');
  } else {
    console.log('✅ SUCCESS - fetched GBP data:');
    console.log(`   Records: ${data?.length}`);
    console.log(`   Sample:`, data?.[0]);
  }

  // Also test client_metrics_summary
  console.log('\n\nChecking client_metrics_summary (for comparison)...\n');

  const { data: metricsData, error: metricsError } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);

  if (metricsError) {
    console.log('❌ Cannot read client_metrics_summary');
    console.log(`   Message: ${metricsError.message}`);
  } else {
    console.log('✅ Can read client_metrics_summary');
    console.log(`   Records: ${metricsData?.length}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

checkRLS();
