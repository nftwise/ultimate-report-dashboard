import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFormEvent() {
  // Get sample submit_form_successful event
  const { data: sampleEvent, error: eventError } = await supabase
    .from('ga4_events')
    .select('*')
    .eq('event_name', 'submit_form_successful')
    .limit(1);

  if (eventError) {
    console.error('Error fetching event:', eventError);
    return;
  }

  console.log('Sample submit_form_successful event:');
  console.log(JSON.stringify(sampleEvent[0], null, 2));

  // Check client_metrics_summary for form_fills
  console.log('\n---\n');
  const { data: metricsData, error: metricsError } = await supabase
    .from('client_metrics_summary')
    .select('client_id, form_fills, date')
    .eq('client_id', sampleEvent[0]?.client_id)
    .order('date', { ascending: false })
    .limit(5);

  if (metricsError) {
    console.error('Error fetching metrics:', metricsError);
    return;
  }

  console.log('client_metrics_summary form_fills (latest 5 days):');
  metricsData?.forEach((metric: any) => {
    console.log(`${metric.date}: form_fills = ${metric.form_fills}`);
  });
}

checkFormEvent().catch(console.error);
