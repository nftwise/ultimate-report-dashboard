// Check what methods are available on webmasters API
const { google } = require('googleapis');
const fs = require('fs');
const { JWT } = require('google-auth-library');

async function checkMethods() {
  const rawKey = fs.readFileSync('temp-private-key.txt', 'utf8');

  const auth = new JWT({
    email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
    key: rawKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const webmasters = google.webmasters({ version: 'v3', auth: auth });

  console.log('Available methods on webmasters client:');
  console.log(Object.keys(webmasters));

  console.log('\nTrying to list sites...');
  try {
    const sitesResponse = await webmasters.sites.list({});
    console.log('✅ Sites:', sitesResponse.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\nTrying searchanalytics.query...');
  try {
    const queryResponse = await webmasters.searchanalytics.query({
      siteUrl: 'https://drdigrado.com/',
      requestBody: {
        startDate: '2025-10-07',
        endDate: '2025-10-14',
        dimensions: ['query'],
        rowLimit: 3
      }
    });
    console.log('✅ Query worked! Got', queryResponse.data.rows?.length || 0, 'rows');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMethods();
