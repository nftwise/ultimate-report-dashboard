/**
 * Test Google Ads REST API directly to verify endpoint and query format
 */
require('dotenv').config({ path: '.env.local' });

async function testGoogleAdsREST() {
  try {
    console.log('=== Testing Google Ads REST API ===\n');

    // Step 1: Get Access Token
    console.log('Step 1: Getting access token...');
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Access token obtained\n');

    // Step 2: Clean customer ID
    const customerId = '2812810609'; // From clients.json
    const mccId = '8432700368';

    console.log('Step 2: Making Google Ads API request...');
    console.log('Customer ID:', customerId);
    console.log('MCC ID:', mccId);

    // Step 3: Try the REST API endpoint with v20 (current version)
    const apiUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;
    console.log('API URL:', apiUrl);

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      LIMIT 5
    `;

    const headers = {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': mccId,
      'Content-Type': 'application/json',
    };

    console.log('\nRequest headers (without token):');
    console.log({
      'developer-token': headers['developer-token'],
      'login-customer-id': headers['login-customer-id'],
      'Content-Type': headers['Content-Type'],
    });

    console.log('\nQuery:');
    console.log(query);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    console.log('\nResponse status:', response.status);
    console.log('Response status text:', response.statusText);

    const responseText = await response.text();

    if (!response.ok) {
      console.log('\n❌ API Error Response:');
      console.log(responseText.substring(0, 500));
      return;
    }

    const data = JSON.parse(responseText);
    console.log('\n✅ SUCCESS! Response data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.results && data.results.length > 0) {
      console.log('\n✅ Found', data.results.length, 'campaigns');
      data.results.forEach((result, i) => {
        console.log(`\nCampaign ${i + 1}:`);
        console.log('  Name:', result.campaign.name);
        console.log('  Status:', result.campaign.status);
        console.log('  Impressions:', result.metrics.impressions);
        console.log('  Clicks:', result.metrics.clicks);
        console.log('  Cost:', (parseFloat(result.metrics.costMicros || 0) / 1000000).toFixed(2));
      });
    } else {
      console.log('\n⚠️  No results returned');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGoogleAdsREST();
