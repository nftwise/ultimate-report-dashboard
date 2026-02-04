const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  // Get first 5 clients
  const { data: firstClients } = await supabase
    .from('clients')
    .select('id, name, slug')
    .limit(5);

  console.log('\nFirst 5 clients:');
  firstClients?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${c.slug}) - ${c.id}`);
  });

  if (firstClients && firstClients.length > 0) {
    for (const client of firstClients) {
      const { count, data } = await supabase
        .from('gbp_location_daily_metrics')
        .select('*', { count: 'exact' })
        .eq('client_id', client.id)
        .limit(1);

      console.log(`\n${client.name}: ${count || 0} GBP records`);
      if (data && data.length > 0) {
        console.log('  Sample date:', data[0].date);
        console.log('  Sample phone_calls:', data[0].phone_calls);
      }
    }
  }
}

test();
