// Test with manual token injection
const fs = require('fs');
const { JWT } = require('google-auth-library');
const https = require('https');

async function testManualRequest() {
  try {
    const rawKey = fs.readFileSync('temp-private-key.txt', 'utf8');

    console.log('Creating JWT and getting access token...');
    const auth = new JWT({
      email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
      key: rawKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const tokenResponse = await auth.getAccessToken();
    const accessToken = tokenResponse.token;

    console.log('✅ Got access token:', accessToken.substring(0, 30) + '...');

    // Manual HTTPS request to Search Console API
    console.log('\nMaking manual API request...');

    const options = {
      hostname: 'searchconsole.googleapis.com',
      port: 443,
      path: '/v1/sites',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log('Status code:', response.statusCode);
    console.log('Response:', response.data);

    if (response.statusCode === 200) {
      const parsed = JSON.parse(response.data);
      console.log('\n✅ SUCCESS!');
      console.log('Sites:', parsed.siteEntry?.length || 0);
      parsed.siteEntry?.forEach(site => {
        console.log(`  - ${site.siteUrl}`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

testManualRequest();
