// Detailed test to diagnose the private key issue
const fs = require('fs');
const { JWT } = require('google-auth-library');

async function testKeyDetails() {
  try {
    // Read the original private key the user sent
    const rawKey = fs.readFileSync('temp-private-key.txt', 'utf8');

    console.log('=== Raw Key Analysis ===');
    console.log('Length:', rawKey.length);
    console.log('Starts with:', rawKey.substring(0, 30));
    console.log('Ends with:', rawKey.substring(rawKey.length - 30));
    console.log('Has newlines:', rawKey.includes('\n'));
    console.log('Number of lines:', rawKey.split('\n').length);

    // Test creating JWT with raw key directly
    console.log('\n=== Testing JWT Creation ===');
    const auth = new JWT({
      email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
      key: rawKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    console.log('✅ JWT created successfully');

    // Try to get access token
    console.log('\n=== Testing Token Generation ===');
    const tokenResponse = await auth.getAccessToken();

    if (tokenResponse.token) {
      console.log('✅ Access token generated successfully!');
      console.log('Token preview:', tokenResponse.token.substring(0, 20) + '...');

      // Now try to actually call Search Console API
      const { google } = require('googleapis');
      const searchconsole = google.searchconsole({ version: 'v1', auth: auth });

      console.log('\n=== Testing Search Console API ===');
      const sitesResponse = await searchconsole.sites.list({});

      console.log('✅ API call successful!');
      console.log('Sites accessible:', sitesResponse.data.siteEntry?.length || 0);
      sitesResponse.data.siteEntry?.forEach(site => {
        console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
      });

    } else {
      console.log('❌ No access token received');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testKeyDetails();
