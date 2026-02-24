import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllEventNames() {
  // Get all unique event names across all clients
  const { data: events, error: eventError } = await supabase
    .from('ga4_events')
    .select('event_name')
    .order('event_name', { ascending: true });

  if (eventError) {
    console.error('Error fetching events:', eventError);
    return;
  }

  // Get unique event names
  const uniqueEventNames = new Set<string>();
  (events || []).forEach((event: any) => {
    if (event.event_name) {
      uniqueEventNames.add(event.event_name);
    }
  });

  // Sort and display
  const sortedNames = Array.from(uniqueEventNames).sort();

  console.log(`\nTổng số unique event names: ${sortedNames.length}\n`);
  console.log('All event names across all clients:');
  console.log('===================================');
  sortedNames.forEach((name, index) => {
    console.log(`${index + 1}. ${name}`);
  });

  // Highlight events with "success" or "successful" in name
  console.log('\n--- Events containing "success" or "successful" ---');
  const successEvents = sortedNames.filter(name =>
    name.toLowerCase().includes('success')
  );
  if (successEvents.length > 0) {
    successEvents.forEach((name) => {
      console.log(`  ✓ ${name}`);
    });
  } else {
    console.log('  (none found)');
  }
}

getAllEventNames().catch(console.error);
