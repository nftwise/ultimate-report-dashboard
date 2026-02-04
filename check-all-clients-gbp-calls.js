const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllClients() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECK GBP CALLS FIELD NAME FOR ALL CLIENTS');
  console.log('='.repeat(70) + '\n');

  // Get all clients
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, slug');

  console.log(`Total clients: ${allClients?.length}\n`);

  const results = [];

  for (const client of (allClients || []).slice(0, 5)) {
    console.log(`Checking: ${client.name}`);

    const dateToISO = '2026-02-04';
    const dateFromISO = '2026-01-05';

    // Check client_metrics_summary for gbp_calls
    const { data: clientMetrics } = await supabase
      .from('client_metrics_summary')
      .select('date, gbp_calls, total_leads')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .limit(5);

    const clientGbpCallsTotal = (clientMetrics || []).reduce((s, d) => s + (d.gbp_calls || 0), 0);

    // Check gbp_location_daily_metrics for phone_calls
    const { data: gbpMetrics } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, phone_calls')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .limit(5);

    const gbpPhoneCallsTotal = (gbpMetrics || []).reduce((s, d) => s + (d.phone_calls || 0), 0);

    console.log(`  client_metrics_summary.gbp_calls: ${clientGbpCallsTotal} (from ${clientMetrics?.length || 0} records)`);
    console.log(`  gbp_location_daily_metrics.phone_calls: ${gbpPhoneCallsTotal} (from ${gbpMetrics?.length || 0} records)`);

    if (clientMetrics && clientMetrics.length > 0) {
      console.log(`    Sample metric: ${JSON.stringify(clientMetrics[0])}`);
    }

    results.push({
      name: client.name,
      clientGbpCalls: clientGbpCallsTotal,
      gbpPhoneCalls: gbpPhoneCallsTotal,
      clientMetricsCount: clientMetrics?.length || 0,
      gbpMetricsCount: gbpMetrics?.length || 0
    });

    console.log();
  }

  console.log('\nSUMMARY:');
  console.log('='.repeat(70));
  results.forEach(r => {
    console.log(`${r.name}:`);
    console.log(`  client_metrics.gbp_calls: ${r.clientGbpCalls}`);
    console.log(`  gbp_location.phone_calls: ${r.gbpPhoneCalls}`);
  });
}

checkAllClients();
