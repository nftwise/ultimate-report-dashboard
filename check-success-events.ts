import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuccessEvents() {
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  if (clientError) {
    console.error('Error fetching clients:', clientError);
    return;
  }

  console.log(`\nChecking ${clients?.length} clients for success/successful events...\n`);
  console.log('='.repeat(80));

  // For each client, check if they have success/successful events
  let clientsWithSuccess = 0;
  const successEventSummary: { [key: string]: any } = {};

  for (const client of clients || []) {
    const { data: successEvents, error: eventError } = await supabase
      .from('ga4_events')
      .select('event_name, event_count')
      .eq('client_id', client.id)
      .or('event_name.ilike.%successful%,event_name.ilike.%success%');

    if (!eventError && successEvents && successEvents.length > 0) {
      clientsWithSuccess++;

      // Group by event name
      const eventCounts: { [key: string]: number } = {};
      successEvents.forEach((event: any) => {
        eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + (event.event_count || 1);
      });

      successEventSummary[client.name] = eventCounts;
      console.log(`✓ ${client.name}`);
      Object.entries(eventCounts).forEach(([name, count]) => {
        console.log(`    - ${name}: ${count}`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nSummary: ${clientsWithSuccess}/${clients?.length} clients have success/successful events\n`);

  if (clientsWithSuccess === 0) {
    console.log('⚠️  NO clients found with success/successful events in ga4_events table!');
  }
}

checkSuccessEvents().catch(console.error);
