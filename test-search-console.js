/**
 * Test Google Search Console API connection for drdigrado.com
 */
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const path = require('path');

async function testSearchConsole() {
  try {
    console.log('=== Testing Google Search Console API ===\n');

    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    console.log('Service account file:', serviceAccountPath);

    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const authClient = await auth.getClient();
    const webmasters = google.webmasters({ version: 'v3', auth: authClient });

    const siteUrl = 'https://drdigrado.com';
    console.log('Testing site:', siteUrl);

    // Test 1: List sites
    console.log('\n1. Listing all sites accessible by service account...');
    try {
      const sitesResponse = await webmasters.sites.list({});
      console.log('✅ Sites accessible:', sitesResponse.data.siteEntry?.length || 0);
      if (sitesResponse.data.siteEntry) {
        sitesResponse.data.siteEntry.forEach(site => {
          console.log('   - ' + site.siteUrl);
        });
      }
    } catch (error) {
      console.log('❌ Failed to list sites:', error.message);
    }

    // Test 2: Try to query data
    console.log('\n2. Trying to query Search Console data for', siteUrl);
    try {
      const response = await webmasters.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: '2025-10-07',
          endDate: '2025-10-14',
          dimensions: ['query'],
          rowLimit: 5
        }
      });

      console.log('✅ SUCCESS! Got data:', response.data.rows?.length || 0, 'rows');
      if (response.data.rows) {
        console.log('\nTop queries:');
        response.data.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.keys[0]} - ${row.clicks} clicks, ${row.impressions} impressions`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to query data:', error.message);

      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        console.log('\n⚠️  SERVICE ACCOUNT NOT ADDED TO SEARCH CONSOLE');
        console.log('   You need to add this service account as a user:');
        console.log('   Email:', require(serviceAccountPath).client_email);
        console.log('\n   Steps:');
        console.log('   1. Go to https://search.google.com/search-console');
        console.log('   2. Select property: https://drdigrado.com');
        console.log('   3. Go to Settings > Users and permissions');
        console.log('   4. Click "Add user"');
        console.log('   5. Add email:', require(serviceAccountPath).client_email);
        console.log('   6. Set permission level to "Full" or "Restricted"');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testSearchConsole();
