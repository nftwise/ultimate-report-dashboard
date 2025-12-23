// Test Search Console authentication with the private key
const fs = require('fs');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

async function testAuth() {
  try {
    // Read and convert the private key
    const escapedKey = fs.readFileSync('temp-private-key-escaped-fixed.txt', 'utf8').trim();
    const privateKey = escapedKey.replace(/\\n/g, '\n');
    const clientEmail = 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com';
    const siteUrl = 'https://drdigrado.com/';

    console.log('Testing Search Console authentication...');
    console.log('Site URL:', siteUrl);
    console.log('Client Email:', clientEmail);

    // Create JWT auth
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    // Create Search Console client
    const searchconsole = google.searchconsole({ version: 'v1', auth: auth });

    // Test 1: List sites
    console.log('\n📋 Test 1: Listing accessible sites...');
    const sitesResponse = await searchconsole.sites.list({});
    console.log('Sites accessible:', sitesResponse.data.siteEntry?.length || 0);
    sitesResponse.data.siteEntry?.forEach(site => {
      console.log(`  - ${site.siteUrl} (Permission: ${site.permissionLevel})`);
    });

    // Test 2: Get performance data
    console.log('\n📊 Test 2: Getting performance data for', siteUrl);
    const response = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: '2025-10-07',
        endDate: '2025-10-14',
        dimensions: ['query'],
        rowLimit: 5
      }
    });

    console.log('✅ SUCCESS! Got', response.data.rows?.length || 0, 'rows');
    console.log('Top queries:');
    response.data.rows?.slice(0, 5).forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.keys[0]} - Clicks: ${row.clicks}, Impressions: ${row.impressions}`);
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.errors) {
      console.error('Error details:', JSON.stringify(error.errors, null, 2));
    }
  }
}

testAuth();
