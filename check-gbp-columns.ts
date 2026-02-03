import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGbpColumns() {
  // Get one record from client_metrics_summary to see all available columns
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data in client_metrics_summary');
    return;
  }

  const record = data[0];
  console.log('\n' + '='.repeat(70));
  console.log('All columns in client_metrics_summary:');
  console.log('='.repeat(70) + '\n');

  const columns = Object.keys(record).sort();
  columns.forEach((col) => {
    console.log(`  ${col}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('GBP-related columns:');
  console.log('='.repeat(70) + '\n');

  const gbpColumns = columns.filter(col => col.toLowerCase().includes('gbp') || col.toLowerCase().includes('phone') || col.toLowerCase().includes('profile') || col.toLowerCase().includes('web_click') || col.toLowerCase().includes('direction'));
  gbpColumns.forEach((col) => {
    const value = record[col];
    console.log(`  ${col}: ${value} (type: ${typeof value})`);
  });

  if (gbpColumns.length === 0) {
    console.log('  No GBP columns found with those keywords');
  }
}

checkGbpColumns().catch(console.error);
