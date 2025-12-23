// Test with correct endpoint
const fs = require('fs');
const { JWT } = require('google-auth-library');
const https = require('https');

async function testCorrectEndpoint() {
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

    console.log('✅ Got access token');

    // Try the webmasters API (old name for Search Console)
    console.log('\nTrying webmasters.googleapis.com endpoint...');

    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: '/webmasters/v3/sites',
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
            data: data
          });
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log('Status code:', response.statusCode);

    if (response.statusCode === 200) {
      const parsed = JSON.parse(response.data);
      console.log('\n✅ SUCCESS!');
      console.log('Sites accessible:', parsed.siteEntry?.length || 0);
      parsed.siteEntry?.forEach(site => {
        console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
      });

      // Now try to get data from drdigrado.com
      if (parsed.siteEntry && parsed.siteEntry.length > 0) {
        console.log('\n📊 Testing data query for drdigrado.com...');

        const queryOptions = {
          hostname: 'www.googleapis.com',
          port: 443,
          path: '/webmasters/v3/sites/https%3A%2F%2Fdrdigrado.com%2F/searchAnalytics/query',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        };

        const queryBody = JSON.stringify({
          startDate: '2025-10-07',
          endDate: '2025-10-14',
          dimensions: ['query'],
          rowLimit: 5
        });

        const queryResponse = await new Promise((resolve, reject) => {
          const req = https.request(queryOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode,
                data: data
              });
            });
          });

          req.on('error', reject);
          req.write(queryBody);
          req.end();
        });

        console.log('Query status:', queryResponse.statusCode);
        if (queryResponse.statusCode === 200) {
          const queryData = JSON.parse(queryResponse.data);
          console.log('✅ Got', queryData.rows?.length || 0, 'query rows');
          queryData.rows?.slice(0, 3).forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.keys[0]} - Clicks: ${row.clicks}`);
          });
        } else {
          console.log('Query response:', queryResponse.data);
        }
      }
    } else {
      console.log('Response:', response.data);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testCorrectEndpoint();
