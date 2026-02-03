import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActualColumns() {
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
  const columns = Object.keys(record).sort();

  console.log('\n' + '='.repeat(70));
  console.log('All columns in client_metrics_summary:');
  console.log('='.repeat(70) + '\n');

  columns.forEach((col) => {
    console.log(`  ${col}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('GBP-related columns (actual):');
  console.log('='.repeat(70) + '\n');

  const gbpColumns = columns.filter(col => col.toLowerCase().includes('gbp'));
  gbpColumns.forEach((col) => {
    const value = record[col];
    console.log(`  ${col}: ${value} (type: ${typeof value})`);
  });

  if (gbpColumns.length === 0) {
    console.log('  ❌ No GBP columns found');
  }

  console.log('\n' + '='.repeat(70));
  console.log('All columns containing "call", "view", "click", "direction":');
  console.log('='.repeat(70) + '\n');

  const relatedCols = columns.filter(col =>
    col.toLowerCase().includes('call') ||
    col.toLowerCase().includes('view') ||
    col.toLowerCase().includes('click') ||
    col.toLowerCase().includes('direction')
  );

  relatedCols.forEach((col) => {
    const value = record[col];
    console.log(`  ${col}: ${value}`);
  });
}

checkActualColumns().catch(console.error);
