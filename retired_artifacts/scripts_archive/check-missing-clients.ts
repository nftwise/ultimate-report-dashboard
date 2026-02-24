import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingClients() {
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  if (clientError) {
    console.error('Error fetching clients:', clientError);
    return;
  }

  console.log(`\nChecking which clients DON'T have success/successful events...\n`);
  console.log('='.repeat(80));

  const missingClients: string[] = [];

  for (const client of clients || []) {
    const { data: successEvents, error: eventError } = await supabase
      .from('ga4_events')
      .select('event_name')
      .eq('client_id', client.id)
      .or('event_name.ilike.%successful%,event_name.ilike.%success%');

    if (!successEvents || successEvents.length === 0) {
      missingClients.push(client.name);

      // Also check if they have ANY events at all
      const { data: allEvents } = await supabase
        .from('ga4_events')
        .select('event_name')
        .eq('client_id', client.id)
        .limit(5);

      const hasAnyEvents = (allEvents && allEvents.length > 0);
      if (hasAnyEvents) {
        const eventNames = [...new Set(allEvents.map((e: any) => e.event_name))].join(', ');
        console.log(`✗ ${client.name}`);
        console.log(`    Has other events: ${eventNames}`);
      } else {
        console.log(`✗ ${client.name} (NO DATA at all)`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nClients WITHOUT success/successful events: ${missingClients.length}/${clients?.length}\n`);
  missingClients.forEach((name, i) => {
    console.log(`${i + 1}. ${name}`);
  });
}

checkMissingClients().catch(console.error);
