const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDateAlignment() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECK DATE ALIGNMENT FOR DECARLO (has real GBP data)');
  console.log('='.repeat(70) + '\n');

  const clientId = 'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6'; // DeCarlo
  const dateFromISO = '2026-01-30';
  const dateToISO = '2026-02-04';

  // Get metrics data
  const { data: metricsData } = await supabase
    .from('client_metrics_summary')
    .select('date, gbp_calls, total_leads, form_fills')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .order('date', { ascending: true });

  console.log('client_metrics_summary records:');
  metricsData?.forEach(m => {
    console.log(`  ${m.date}: gbp_calls=${m.gbp_calls}, total_leads=${m.total_leads}`);
  });

  // Get GBP data
  const { data: gbpData } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls, website_clicks, direction_requests')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .order('date', { ascending: true });

  console.log('\ngbp_location_daily_metrics records:');
  gbpData?.forEach(g => {
    console.log(`  ${g.date}: phone_calls=${g.phone_calls}, website_clicks=${g.website_clicks}, directions=${g.direction_requests}`);
  });

  // Check date matching
  console.log('\nDate alignment check:');
  const metricsDateSet = new Set(metricsData?.map(d => d.date) || []);
  const gbpDateSet = new Set(gbpData?.map(d => d.date) || []);

  const allDates = new Set([...metricsDateSet, ...gbpDateSet]);
  allDates.forEach(date => {
    const inMetrics = metricsDateSet.has(date);
    const inGbp = gbpDateSet.has(date);
    const symbol = inMetrics && inGbp ? '✅' : '⚠️';
    console.log(`  ${symbol} ${date}: metrics=${inMetrics}, gbp=${inGbp}`);
  });

  // Simulate merge
  console.log('\nAfter merge (what dashboard should show):');
  const merged = (metricsData || []).map(metric => {
    const gbp = gbpData?.find(g => g.date === metric.date);
    return {
      date: metric.date,
      gbp_calls: gbp?.phone_calls || metric.gbp_calls || 0,
      gbp_website_clicks: gbp?.website_clicks || 0,
      gbp_direction_requests: gbp?.direction_requests || 0
    };
  });

  merged.forEach(m => {
    console.log(`  ${m.date}: gbp_calls=${m.gbp_calls}, web_clicks=${m.gbp_website_clicks}, directions=${m.gbp_direction_requests}`);
  });

  const totalCalls = merged.reduce((s, d) => s + d.gbp_calls, 0);
  const totalClicks = merged.reduce((s, d) => s + d.gbp_website_clicks, 0);
  const totalDirections = merged.reduce((s, d) => s + d.gbp_direction_requests, 0);

  console.log(`\nTotals for ${dateFromISO} to ${dateToISO}:`);
  console.log(`  Phone Calls: ${totalCalls}`);
  console.log(`  Web Clicks: ${totalClicks}`);
  console.log(`  Directions: ${totalDirections}`);
}

checkDateAlignment();
