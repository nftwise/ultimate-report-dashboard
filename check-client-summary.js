const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const clientId = '7fe8d45e-9171-4994-a9b7-2957d71ab750'; // Dr DiGrado
  
  // Check client_metrics_summary for GBP data
  console.log('\n=== CLIENT_METRICS_SUMMARY (Dr DiGrado) ===');
  const { data: summary } = await supabase
    .from('client_metrics_summary')
    .select('date, gbp_calls, gbp_views, gbp_website_clicks, gbp_direction_requests, gbp_total_actions')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(10);
  
  console.log('Summary GBP columns:', JSON.stringify(summary, null, 2));

  // Check what GBP columns exist in client_metrics_summary
  console.log('\n=== ALL COLUMNS IN CLIENT_METRICS_SUMMARY ===');
  const { data: sample } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);
  
  if (sample && sample.length > 0) {
    const gbpCols = Object.keys(sample[0]).filter(k => k.includes('gbp'));
    console.log('GBP-related columns:', gbpCols);
    console.log('Sample values:', gbpCols.map(c => `${c}: ${sample[0][c]}`));
  }
}

check();
