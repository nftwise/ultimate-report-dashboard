// Test Search Console with direct authorization
const fs = require('fs');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

async function testDirectAuth() {
  try {
    const rawKey = fs.readFileSync('temp-private-key.txt', 'utf8');

    console.log('Creating JWT client...');
    const auth = new JWT({
      email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
      key: rawKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    // Authorize first
    console.log('Authorizing...');
    await auth.authorize();
    console.log('✅ Authorization successful');
    console.log('Access token exists:', !!auth.credentials.access_token);

    // Create Search Console client with authorized client
    console.log('\nCreating Search Console client...');
    const searchconsole = google.searchconsole({
      version: 'v1',
      auth: auth
    });

    // List sites
    console.log('Listing sites...');
    const sitesResponse = await searchconsole.sites.list({});

    console.log('✅ SUCCESS!');
    console.log('Sites:', sitesResponse.data.siteEntry?.length || 0);
    sitesResponse.data.siteEntry?.forEach(site => {
      console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
    });

    // Try to query specific site
    console.log('\nQuerying drdigrado.com...');
    const queryResponse = await searchconsole.searchanalytics.query({
      siteUrl: 'https://drdigrado.com/',
      requestBody: {
        startDate: '2025-10-07',
        endDate: '2025-10-14',
        dimensions: ['query'],
        rowLimit: 5
      }
    });

    console.log('✅ Query successful!');
    console.log('Rows:', queryResponse.data.rows?.length || 0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error code:', error.code);

    if (error.response?.data?.error) {
      console.error('\nDetailed error:');
      console.error(JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

testDirectAuth();
