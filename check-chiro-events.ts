import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getChiroFirstEvents() {
  // First get Chiro First client ID
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%chiropractic first%');

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.error('Chiropractic First not found');
    return;
  }

  const chiroId = clients[0].id;
  console.log(`\nFound: ${clients[0].name} (ID: ${chiroId})\n`);

  // Get all events for Dec 2025
  const { data: events, error: eventError } = await supabase
    .from('ga4_events')
    .select('*')
    .eq('client_id', chiroId)
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-31')
    .order('date', { ascending: false });

  if (eventError) {
    console.error('Error fetching events:', eventError);
    return;
  }

  const eventCount = events ? events.length : 0;
  console.log(`Total events in Dec 2025: ${eventCount}\n`);

  // Group by event name
  const eventCounts: { [key: string]: number } = {};
  if (events) {
    events.forEach((event: any) => {
      const name = event.event_name || 'unknown';
      eventCounts[name] = (eventCounts[name] || 0) + (event.event_count || 1);
    });
  }

  console.log('Events breakdown (sorted by count):');
  Object.entries(eventCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });

  // Show events with "success" in name
  console.log('\n--- Events containing "success" ---');
  const successEvents = Object.entries(eventCounts).filter(([name]) =>
    name.toLowerCase().includes('success')
  );
  if (successEvents.length > 0) {
    successEvents.forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
  } else {
    console.log('  (none found)');
  }
}

getChiroFirstEvents().catch(console.error);
