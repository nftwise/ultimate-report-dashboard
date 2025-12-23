import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

async function refreshToken() {
  const masterTokenPath = path.join(process.cwd(), '.oauth-tokens', 'gbp-master.json');

  if (!fs.existsSync(masterTokenPath)) {
    console.log('No master token file found');
    return;
  }

  const tokenData = JSON.parse(fs.readFileSync(masterTokenPath, 'utf8'));
  console.log('Current token expiry:', new Date(tokenData.expiry_date).toISOString());
  console.log('Refresh token (first 30 chars):', tokenData.refresh_token?.substring(0, 30));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: tokenData.refresh_token });

  try {
    console.log('\nRefreshing token...');
    const { credentials } = await oauth2Client.refreshAccessToken();

    console.log('New access token (first 30 chars):', credentials.access_token?.substring(0, 30));
    console.log('New expiry:', credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A');

    // Save new token
    const newTokenData = {
      ...tokenData,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };

    fs.writeFileSync(masterTokenPath, JSON.stringify(newTokenData, null, 2));
    console.log('\nToken saved to:', masterTokenPath);

    // Test the new token
    console.log('\n--- Testing new token ---');
    const url = `https://businessprofileperformance.googleapis.com/v1/locations/15767825285937852276:getDailyMetricsTimeSeries?dailyMetric=WEBSITE_CLICKS&dailyRange.start_date.year=2025&dailyRange.start_date.month=12&dailyRange.start_date.day=14&dailyRange.end_date.year=2025&dailyRange.end_date.month=12&dailyRange.end_date.day=14`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${credentials.access_token}` }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('API test SUCCESS!');
      console.log('Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('API test FAILED:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Refresh failed:', error);
  }
}

refreshToken().catch(console.error);
