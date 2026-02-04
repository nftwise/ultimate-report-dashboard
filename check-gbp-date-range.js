const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGbpDateRange() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECK GBP DATA DATE RANGES');
  console.log('='.repeat(70) + '\n');

  const clientId = 'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6'; // DeCarlo

  // Get min and max dates for GBP data
  const { data: gbpMinMax } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: true })
    .limit(1);

  const { data: gbpMinMaxDesc } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1);

  console.log('GBP data date range:');
  console.log(`  Earliest: ${gbpMinMax?.[0]?.date}`);
  console.log(`  Latest: ${gbpMinMaxDesc?.[0]?.date}`);

  // Get min and max dates for metrics data
  const { data: metricsMinMax } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: true })
    .limit(1);

  const { data: metricsMinMaxDesc } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1);

  console.log('\nMetrics data date range:');
  console.log(`  Earliest: ${metricsMinMax?.[0]?.date}`);
  console.log(`  Latest: ${metricsMinMaxDesc?.[0]?.date}`);

  // Find overlapping dates
  console.log('\nFinding overlapping dates...');
  const gbpEarliest = gbpMinMax?.[0]?.date;
  const gbpLatest = gbpMinMaxDesc?.[0]?.date;

  if (gbpEarliest && gbpLatest) {
    const { data: overlappingGbp, count } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, phone_calls', { count: 'exact' })
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(10);

    console.log(`\nLatest 10 GBP dates for DeCarlo:`);
    overlappingGbp?.forEach(d => {
      console.log(`  ${d.date}: ${d.phone_calls} calls`);
    });

    // Now check metrics for same dates
    if (overlappingGbp && overlappingGbp.length > 0) {
      const latestGbpDate = overlappingGbp[0].date;
      const { data: metricsForGbpDate } = await supabase
        .from('client_metrics_summary')
        .select('date, gbp_calls, total_leads')
        .eq('client_id', clientId)
        .eq('date', latestGbpDate);

      console.log(`\nMetrics for same date ${latestGbpDate}:`);
      metricsForGbpDate?.forEach(d => {
        console.log(`  ${d.date}: gbp_calls=${d.gbp_calls}, total_leads=${d.total_leads}`);
      });
    }
  }
}

checkGbpDateRange();
