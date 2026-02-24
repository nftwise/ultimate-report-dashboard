import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetricsColumns() {
  // Get one record to see all columns
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data in client_metrics_summary');
    return;
  }

  const record = data[0];
  console.log('\nAll columns in client_metrics_summary:\n');
  console.log('='.repeat(50));

  const columns = Object.keys(record).sort();
  columns.forEach((col, i) => {
    const value = record[col];
    const valueStr = value !== null && value !== undefined ? `(${typeof value})` : '(null)';
    console.log(`${i + 1}. ${col} ${valueStr}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log(`\nTotal columns: ${columns.length}`);

  // Show which columns have "conv" or "cpl" in the name
  console.log('\n--- Columns related to conversions/CPL ---');
  const relevantCols = columns.filter(col =>
    col.toLowerCase().includes('conv') ||
    col.toLowerCase().includes('cpl') ||
    col.toLowerCase().includes('cost') ||
    col.toLowerCase().includes('spend') ||
    col.toLowerCase().includes('ads')
  );

  if (relevantCols.length > 0) {
    relevantCols.forEach(col => {
      console.log(`  ${col}: ${record[col]}`);
    });
  } else {
    console.log('  (none found)');
  }
}

checkMetricsColumns().catch(console.error);
