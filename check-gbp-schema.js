const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGBP() {
  // 1. Check gbp_location_daily_metrics sample data
  console.log('\n=== GBP_LOCATION_DAILY_METRICS SAMPLE ===');
  const { data: sample, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .limit(3);
  
  if (sample && sample.length > 0) {
    console.log('Columns:', Object.keys(sample[0]));
    console.log('Sample rows:', JSON.stringify(sample, null, 2));
  } else {
    console.log('No data or error:', error);
  }

  // 2. Check recent data with non-zero values
  console.log('\n=== GBP DATA WITH VALUES ===');
  const { data: withData } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, date, views, phone_calls, website_clicks, direction_requests, total_reviews, average_rating')
    .or('phone_calls.gt.0,website_clicks.gt.0,direction_requests.gt.0')
    .order('date', { ascending: false })
    .limit(10);
  
  console.log('Rows with data:', JSON.stringify(withData, null, 2));

  // 3. Check gbp_locations
  console.log('\n=== GBP_LOCATIONS ===');
  const { data: locs } = await supabase
    .from('gbp_locations')
    .select('id, client_id, location_name, address, phone')
    .limit(5);
  
  console.log('Locations:', JSON.stringify(locs, null, 2));

  // 4. Check specific client (Dr DiGrado)
  console.log('\n=== DR DIGRADO CLIENT ===');
  const { data: digrado } = await supabase
    .from('clients')
    .select('id, name, slug')
    .ilike('name', '%digrado%');
  
  console.log('DiGrado client:', JSON.stringify(digrado, null, 2));

  if (digrado && digrado.length > 0) {
    const clientId = digrado[0].id;
    
    // Check GBP data for this client
    console.log('\n=== DR DIGRADO GBP DATA ===');
    const { data: gbpData } = await supabase
      .from('gbp_location_daily_metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(5);
    
    console.log('DiGrado GBP data:', JSON.stringify(gbpData, null, 2));
  }
}

checkGBP();
