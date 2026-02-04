const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGbpTable() {
  console.log('\n' + '='.repeat(70));
  console.log('GBP_LOCATION_DAILY_METRICS STRUCTURE CHECK');
  console.log('='.repeat(70) + '\n');

  try {
    const { count } = await supabase
      .from('gbp_location_daily_metrics')
      .select('*', { count: 'exact', head: true });

    console.log('Total records in table:', count);

    const { data: samples } = await supabase
      .from('gbp_location_daily_metrics')
      .select('*')
      .limit(2);

    console.log('\nSample record (structure):');
    if (samples && samples[0]) {
      console.log(JSON.stringify(samples[0], null, 2));
    }

    const { data: clientsInTable } = await supabase
      .from('gbp_location_daily_metrics')
      .select('client_id, COUNT(*) as record_count')
      .limit(5);

    console.log('\nClient IDs in table (first 5):');
    clientsInTable?.forEach(row => {
      console.log(`  ${row.client_id}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkGbpTable();
