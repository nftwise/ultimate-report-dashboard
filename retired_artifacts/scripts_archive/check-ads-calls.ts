import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdsColumns() {
  // Get sample record to see all ADS related columns
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data found');
    return;
  }

  const record = data[0];

  console.log('\n='.repeat(70));
  console.log('All ADS-related columns in client_metrics_summary:');
  console.log('='.repeat(70) + '\n');

  const adsColumns = Object.keys(record)
    .filter(col => col.toLowerCase().includes('ads') || col.toLowerCase().includes('ad_'))
    .sort();

  adsColumns.forEach((col) => {
    const value = record[col];
    console.log(`${col}: ${value} (${typeof value})`);
  });

  console.log('\n='.repeat(70));
  console.log('Columns including "call" or "phone":');
  console.log('='.repeat(70) + '\n');

  const callColumns = Object.keys(record)
    .filter(col =>
      col.toLowerCase().includes('call') ||
      col.toLowerCase().includes('phone') ||
      col.toLowerCase().includes('conversion')
    )
    .sort();

  callColumns.forEach((col) => {
    const value = record[col];
    console.log(`${col}: ${value} (${typeof value})`);
  });
}

checkAdsColumns().catch(console.error);
