import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function check() {
  console.log('🔍 Check GBP data for all clients\n');
  console.log('=' .repeat(70) + '\n');

  // Get all clients
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .order('name');

  console.log(`📋 Total clients: ${clients.length}\n`);

  let clientsWithGBP = 0;
  let clientsWithoutGBP = [];

  for (const client of clients) {
    // Check if client has GBP locations
    const { data: locations } = await supabaseAdmin
      .from('gbp_locations')
      .select('id')
      .eq('client_id', client.id)
      .eq('is_active', true);

    if (locations && locations.length > 0) {
      // Check if has data in Feb 2026
      const { data: data } = await supabaseAdmin
        .from('gbp_location_daily_metrics')
        .select('id')
        .eq('client_id', client.id)
        .gte('date', '2026-02-01')
        .lte('date', '2026-02-28');

      const hasData = data && data.length > 0;
      const status = hasData ? '✅ Has data' : '⚠️  No Feb data';
      console.log(`${status} | ${client.name.padEnd(40)} (${locations.length} location${locations.length > 1 ? 's' : ''})`);
      clientsWithGBP++;
    } else {
      console.log(`❌ No GBP   | ${client.name}`);
      clientsWithoutGBP.push(client.name);
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
  console.log(`✅ Clients with GBP: ${clientsWithGBP}/${clients.length}`);
  console.log(`❌ Clients without GBP: ${clientsWithoutGBP.length}/${clients.length}`);

  if (clientsWithoutGBP.length > 0) {
    console.log('\nNo GBP Setup:');
    clientsWithoutGBP.forEach(name => console.log(`  • ${name}`));
  }
}

check().catch(console.error);
