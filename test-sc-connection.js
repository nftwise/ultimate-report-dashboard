/**
 * Test Google Search Console API connection
 */
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function testSearchConsole() {
  try {
    console.log('=== Testing Google Search Console API ===\n');

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'https://drdigrado.com';

    console.log('Service Account Email:', clientEmail);
    console.log('Site URL:', siteUrl);
    console.log('Private Key exists:', !!privateKey);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const authClient = await auth.getClient();
    const webmasters = google.webmasters({ version: 'v3', auth: authClient });

    // Test 1: List all sites
    console.log('\n1. Listing all sites accessible by service account...');
    try {
      const sitesResponse = await webmasters.sites.list({});
      console.log('✅ Sites accessible:', sitesResponse.data.siteEntry?.length || 0);

      if (sitesResponse.data.siteEntry) {
        sitesResponse.data.siteEntry.forEach(site => {
          console.log('   -', site.siteUrl, '(Permission:', site.permissionLevel + ')');
        });

        // Check if drdigrado.com is in the list
        const hasDrDigrado = sitesResponse.data.siteEntry.some(
          site => site.siteUrl === siteUrl || site.siteUrl === 'sc-domain:drdigrado.com'
        );

        if (hasDrDigrado) {
          console.log('\n✅ drdigrado.com is accessible!');
        } else {
          console.log('\n⚠️  drdigrado.com is NOT in the accessible sites list');
          console.log('   Available sites:', sitesResponse.data.siteEntry.map(s => s.siteUrl).join(', '));
        }
      }
    } catch (error) {
      console.log('❌ Failed to list sites:', error.message);
      if (error.code === 403) {
        console.log('   This means the service account has no access to ANY Search Console properties');
      }
    }

    // Test 2: Try to query data for drdigrado.com
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

      console.log('✅ SUCCESS! Got', response.data.rows?.length || 0, 'rows');

      if (response.data.rows && response.data.rows.length > 0) {
        console.log('\nTop queries:');
        response.data.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.keys[0]}`);
          console.log(`     Clicks: ${row.clicks}, Impressions: ${row.impressions}`);
        });
      } else {
        console.log('⚠️  No data returned (might be no traffic for this period)');
      }
    } catch (error) {
      console.log('❌ Failed to query data:', error.message);
      console.log('   Error code:', error.code);

      if (error.code === 403 || error.message.includes('403')) {
        console.log('\n⚠️  403 FORBIDDEN - Service account does not have access');
        console.log('   Possible issues:');
        console.log('   1. Service account not added to this specific property');
        console.log('   2. Wrong URL format (try sc-domain:drdigrado.com)');
        console.log('   3. Permission level too low');
      }

      if (error.code === 404) {
        console.log('\n⚠️  404 NOT FOUND - Property does not exist or wrong URL');
      }
    }

    // Test 3: Try domain property format
    const domainUrl = 'sc-domain:drdigrado.com';
    console.log('\n3. Trying domain property format:', domainUrl);
    try {
      const response = await webmasters.searchanalytics.query({
        siteUrl: domainUrl,
        requestBody: {
          startDate: '2025-10-07',
          endDate: '2025-10-14',
          dimensions: ['query'],
          rowLimit: 5
        }
      });

      console.log('✅ SUCCESS with domain format! Got', response.data.rows?.length || 0, 'rows');
    } catch (error) {
      console.log('❌ Domain format also failed:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
  }
}

testSearchConsole();
