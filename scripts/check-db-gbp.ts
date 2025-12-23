import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get client ID for the first GBP-configured client
  const { data: configs } = await supabase
    .from('service_configs')
    .select('client_id, gbp_location_id')
    .not('gbp_location_id', 'is', null)
    .limit(1);

  if (!configs || configs.length === 0) {
    console.log('No GBP configured clients');
    return;
  }

  const clientId = configs[0].client_id;
  console.log('Client ID:', clientId);
  console.log('Location ID:', configs[0].gbp_location_id);

  // Get metrics for dates 12-12 through 12-16
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, gbp_website_clicks, gbp_directions, gbp_calls, gbp_profile_views')
    .eq('client_id', clientId)
    .gte('date', '2025-12-12')
    .lte('date', '2025-12-16')
    .order('date');

  console.log('\nCurrent DB values:');
  console.log('Date\t\t\tClicks\tDirs\tCalls\tViews');
  console.log('-'.repeat(60));
  (data || []).forEach(row => {
    console.log(`${row.date}\t${row.gbp_website_clicks}\t${row.gbp_directions}\t${row.gbp_calls}\t${row.gbp_profile_views}`);
  });

  if (error) {
    console.log('Error:', error);
  }
}

check().catch(console.error);
