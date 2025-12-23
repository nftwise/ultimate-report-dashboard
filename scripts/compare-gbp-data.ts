import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function compareData() {
  // Get token
  const masterTokenPath = path.join(process.cwd(), '.oauth-tokens', 'gbp-master.json');
  if (!fs.existsSync(masterTokenPath)) {
    console.log('No master token file found');
    return;
  }
  const tokenData = JSON.parse(fs.readFileSync(masterTokenPath, 'utf8'));
  const token = tokenData.access_token;

  // Get a client with GBP
  const { data: configs } = await supabaseAdmin
    .from('service_configs')
    .select('client_id, gbp_location_id')
    .eq('client_id', '7fe8d45e-9171-4994-a9b7-2957d71ab750')
    .single();

  if (!configs) {
    console.log('No client found');
    return;
  }

  const locationId = configs.gbp_location_id;
  let normalizedId = locationId;
  if (!locationId.startsWith('locations/')) {
    normalizedId = `locations/${locationId}`;
  }

  console.log('Location:', normalizedId);
  console.log('\n=== API DATA (last 7 days) ===');

  // Calculate last 7 days
  const end = new Date();
  end.setDate(end.getDate() - 1); // Yesterday
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // 7 days back

  console.log('Date range:', start.toISOString().split('T')[0], 'to', end.toISOString().split('T')[0]);

  const metrics = [
    'WEBSITE_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'CALL_CLICKS',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  ];

  const results: Record<string, number> = {};

  for (const metric of metrics) {
    try {
      const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`);
      url.searchParams.set('dailyMetric', metric);
      url.searchParams.set('dailyRange.start_date.year', start.getFullYear().toString());
      url.searchParams.set('dailyRange.start_date.month', (start.getMonth() + 1).toString());
      url.searchParams.set('dailyRange.start_date.day', start.getDate().toString());
      url.searchParams.set('dailyRange.end_date.year', end.getFullYear().toString());
      url.searchParams.set('dailyRange.end_date.month', (end.getMonth() + 1).toString());
      url.searchParams.set('dailyRange.end_date.day', end.getDate().toString());

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const values = data.timeSeries?.datedValues || [];
        let total = 0;

        // Show daily breakdown
        values.forEach((v: any) => {
          const dateStr = `${v.date.year}-${String(v.date.month).padStart(2, '0')}-${String(v.date.day).padStart(2, '0')}`;
          const val = parseInt(v.value) || 0;
          total += val;
          if (metric === 'WEBSITE_CLICKS' || metric === 'BUSINESS_DIRECTION_REQUESTS') {
            console.log(`  ${metric} ${dateStr}: ${val}`);
          }
        });

        results[metric] = total;
        console.log(`${metric}: ${total} (7-day total)`);
      } else {
        console.log(`${metric}: ERROR ${response.status}`);
      }
    } catch (e) {
      console.log(`${metric}: EXCEPTION`);
    }
  }

  // Calculate profile views (sum of all impressions)
  const profileViews = (results['BUSINESS_IMPRESSIONS_DESKTOP_MAPS'] || 0) +
    (results['BUSINESS_IMPRESSIONS_MOBILE_MAPS'] || 0) +
    (results['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'] || 0) +
    (results['BUSINESS_IMPRESSIONS_MOBILE_SEARCH'] || 0);

  console.log('\n=== COMPARISON ===');
  console.log('API Profile Views (7 days):', profileViews);
  console.log('API Website Clicks (7 days):', results['WEBSITE_CLICKS'] || 0);
  console.log('API Directions (7 days):', results['BUSINESS_DIRECTION_REQUESTS'] || 0);
  console.log('API Call Clicks (7 days):', results['CALL_CLICKS'] || 0);
}

compareData().catch(console.error);
