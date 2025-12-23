// Test if production environment key works
const fs = require('fs');
const { JWT } = require('google-auth-library');

async function testProductionKey() {
  try {
    // Load .env.production.local
    const envContent = fs.readFileSync('.env.production.local', 'utf8');

    // Extract GOOGLE_PRIVATE_KEY
    const keyMatch = envContent.match(/GOOGLE_PRIVATE_KEY="(.+?)"/s);
    if (!keyMatch) {
      throw new Error('Could not find GOOGLE_PRIVATE_KEY in .env.production.local');
    }

    const escapedKey = keyMatch[1];
    console.log('Production key info:');
    console.log('- Length:', escapedKey.length);
    console.log('- Has \\n:', escapedKey.includes('\\n'));
    console.log('- First 50:', escapedKey.substring(0, 50));
    console.log('- Last 50:', escapedKey.substring(escapedKey.length - 50));

    // Convert \n to actual newlines (same as code does)
    const privateKey = escapedKey.replace(/\\n/g, '\n');

    console.log('\nAfter conversion:');
    console.log('- Length:', privateKey.length);
    console.log('- Has actual newlines:', privateKey.includes('\n'));
    console.log('- Number of lines:', privateKey.split('\n').length);

    // Create JWT and test
    const auth = new JWT({
      email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    console.log('\n✅ JWT client created');

    // Get access token
    const tokenResponse = await auth.getAccessToken();
    console.log('✅ Access token generated');

    // Test API call
    const url = 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fdrdigrado.com%2F/searchAnalytics/query';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDate: '2025-10-07',
        endDate: '2025-10-14',
        dimensions: ['query'],
        rowLimit: 3
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful!');
      console.log('Got', data.rows?.length || 0, 'rows');
      data.rows?.slice(0, 3).forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.keys[0]} - Clicks: ${row.clicks}`);
      });
    } else {
      const errorText = await response.text();
      console.log('❌ API call failed:', response.status);
      console.log('Error:', errorText.substring(0, 200));
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testProductionKey();
