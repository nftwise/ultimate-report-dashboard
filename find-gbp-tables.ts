import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findGbpTables() {
  console.log('\n' + '='.repeat(70));
  console.log('Finding tables with GBP-related data');
  console.log('='.repeat(70) + '\n');

  // Try common GBP table names
  const possibleTables = [
    'gbp_metrics',
    'gbp_daily_metrics',
    'gbp_location_metrics',
    'gbp_location_daily_metrics',
    'gbp_data',
    'google_business_metrics',
    'client_gbp_metrics',
    'locations',
    'gbp_locations'
  ];

  for (const tableName of possibleTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (!error && count! > 0) {
        console.log(`✅ Found: ${tableName}`);
        console.log(`   Records: ${count}`);

        // Get columns
        const { data: record } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (record && record.length > 0) {
          const columns = Object.keys(record[0]).sort();
          console.log(`   Columns: ${columns.join(', ')}`);
        }
        console.log();
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }

  console.log('='.repeat(70));
  console.log('\nAlso checking client_metrics_summary for GBP columns:\n');

  const { data: metrics } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1);

  if (metrics && metrics.length > 0) {
    const columns = Object.keys(metrics[0]).sort();
    const gbpColumns = columns.filter(c => c.toLowerCase().includes('gbp'));

    console.log('GBP-related columns in client_metrics_summary:');
    gbpColumns.forEach(col => {
      console.log(`  - ${col}`);
    });

    if (gbpColumns.length === 0) {
      console.log('  (None found)');
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

findGbpTables().catch(console.error);
