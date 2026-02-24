import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
  console.log('\n' + '='.repeat(70));
  console.log('Listing all tables in Supabase database');
  console.log('='.repeat(70) + '\n');

  // Query information_schema to get all tables
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name, table_schema')
    .eq('table_schema', 'public')
    .order('table_name');

  if (error) {
    console.error('Error fetching tables:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No tables found');
    return;
  }

  console.log('Public tables:');
  console.log('='.repeat(70) + '\n');

  data.forEach((table: any, index: number) => {
    console.log(`${index + 1}. ${table.table_name}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${data.length} tables\n`);
}

listAllTables().catch(console.error);
