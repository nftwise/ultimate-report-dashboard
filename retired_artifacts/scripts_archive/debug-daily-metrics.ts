import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMetrics() {
  // Get a client first
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug')
    .limit(1);

  if (clientError || !clients || clients.length === 0) {
    console.error('Error fetching client:', clientError);
    return;
  }

  const client = clients[0];
  console.log('\n='.repeat(70));
  console.log(`Testing client: ${client.name} (ID: ${client.id})`);
  console.log('='.repeat(70));

  // Test different date ranges
  const dateRanges = [
    { from: '2026-01-04', to: '2026-02-03', label: '30 days' },
    { from: '2025-12-01', to: '2025-12-31', label: 'Dec 2025' },
    { from: '2025-11-01', to: '2025-11-30', label: 'Nov 2025' }
  ];

  for (const range of dateRanges) {
    console.log(`\nTesting date range: ${range.label} (${range.from} to ${range.to})`);

    const { data, error } = await supabase
      .from('client_metrics_summary')
      .select(`
        date,
        total_leads,
        form_fills,
        gbp_calls,
        google_ads_conversions,
        ads_spend,
        cpl
      `)
      .eq('client_id', client.id)
      .gte('date', range.from)
      .lte('date', range.to)
      .order('date', { ascending: true })
      .limit(5);

    if (error) {
      console.error(`  ❌ Error:`, error.message);
    } else {
      console.log(`  ✅ Found ${data?.length || 0} records`);
      if (data && data.length > 0) {
        console.log(`  First record:`, data[0]);
        console.log(`  Last record:`, data[data.length - 1]);
      }
    }
  }

  // Check what dates have data
  console.log('\n' + '='.repeat(70));
  console.log('Checking all available dates for this client...');
  const { data: allDates, error: dateError } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(10);

  if (dateError) {
    console.error('Error fetching dates:', dateError);
  } else {
    console.log('Latest 10 dates with data:');
    allDates?.forEach((d: any) => console.log(`  - ${d.date}`));
  }
}

debugMetrics().catch(console.error);
