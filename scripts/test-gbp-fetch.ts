import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGBPFetch() {
  // Get a client with GBP configured
  const { data: configs } = await supabaseAdmin
    .from('service_configs')
    .select('client_id, gbp_location_id')
    .not('gbp_location_id', 'is', null)
    .limit(1);

  if (!configs || configs.length === 0) {
    console.log('No clients with GBP configured');
    return;
  }

  const clientConfig = configs[0];
  console.log('Testing client:', clientConfig.client_id);
  console.log('GBP Location ID:', clientConfig.gbp_location_id);

  // Try to get token from local file
  const masterTokenPath = path.join(process.cwd(), '.oauth-tokens', 'gbp-master.json');
  let token: string;

  if (fs.existsSync(masterTokenPath)) {
    const tokenData = JSON.parse(fs.readFileSync(masterTokenPath, 'utf8'));
    token = tokenData.access_token;
    console.log('Using master token, expires:', new Date(tokenData.expiry_date).toISOString());
  } else {
    console.log('No master token file found');
    return;
  }

  // Test the GBP Performance API directly
  const locationId = clientConfig.gbp_location_id;

  // Normalize location ID
  let normalizedId = locationId;
  if (!locationId.startsWith('locations/')) {
    normalizedId = `locations/${locationId}`;
  }

  const start = new Date('2025-12-14');
  const end = new Date('2025-12-14');

  const metrics = [
    'WEBSITE_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'CALL_CLICKS',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  ];

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
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`${metric}: ERROR ${response.status} - ${errorText}`);
      } else {
        const data = await response.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum: number, d: any) => sum + (parseInt(d.value) || 0), 0);
        console.log(`${metric}: ${value}`);
      }
    } catch (e) {
      console.log(`${metric}: EXCEPTION - ${(e as Error).message}`);
    }
  }

  // Test Reviews API
  console.log('\n--- Testing Reviews API ---');
  try {
    // Get accounts first
    const accountsResp = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!accountsResp.ok) {
      console.log('Accounts API error:', accountsResp.status, await accountsResp.text());
    } else {
      const accountsData = await accountsResp.json();
      console.log('Accounts:', JSON.stringify(accountsData.accounts?.map((a: any) => a.name)));

      if (accountsData.accounts && accountsData.accounts.length > 0) {
        const accountId = accountsData.accounts[0].name?.replace('accounts/', '');
        const locId = locationId.includes('/') ? locationId.split('/').pop() : locationId;

        console.log('Trying reviews for account:', accountId, 'location:', locId);

        const reviewsResp = await fetch(
          `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locId}/reviews`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('Reviews API status:', reviewsResp.status);
        if (!reviewsResp.ok) {
          console.log('Reviews error:', await reviewsResp.text());
        } else {
          const reviewsData = await reviewsResp.json();
          console.log('Total reviews:', reviewsData.totalReviewCount);
          console.log('Avg rating:', reviewsData.averageRating);
        }
      }
    }
  } catch (e) {
    console.log('Reviews exception:', (e as Error).message);
  }
}

testGBPFetch().catch(console.error);
