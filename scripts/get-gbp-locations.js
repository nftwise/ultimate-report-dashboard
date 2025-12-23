/**
 * Script to fetch all Google Business Profile locations
 * This will list all locations with their IDs
 */

const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function getGBPLocations() {
  try {
    // Initialize auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      projectId: process.env.GOOGLE_PROJECT_ID,
      scopes: [
        'https://www.googleapis.com/auth/business.manage',
      ],
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    console.log('🔍 Fetching Google Business Profile accounts...\n');

    // Step 1: List all accounts
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();

    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      console.log('❌ No Google Business Profile accounts found.');
      console.log('\nPossible reasons:');
      console.log('1. The service account doesn\'t have access to any GBP accounts');
      console.log('2. You need to add the service account as a manager in Google Business Profile');
      console.log('3. The API is not enabled or you don\'t have access');
      console.log('\n📖 See GOOGLE_BUSINESS_PROFILE_SETUP.md for help\n');
      return;
    }

    console.log(`✅ Found ${accountsData.accounts.length} account(s)\n`);
    console.log('═'.repeat(80));

    // Step 2: For each account, list locations
    for (const account of accountsData.accounts) {
      console.log(`\n📊 Account: ${account.accountName || 'Unnamed'}`);
      console.log(`   Account ID: ${account.name}\n`);

      try {
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
            },
          }
        );

        if (!locationsResponse.ok) {
          const errorText = await locationsResponse.text();
          console.log(`   ⚠️  Error fetching locations: ${locationsResponse.status}`);
          console.log(`   ${errorText}\n`);
          continue;
        }

        const locationsData = await locationsResponse.json();

        if (!locationsData.locations || locationsData.locations.length === 0) {
          console.log('   ℹ️  No locations found for this account\n');
          continue;
        }

        console.log(`   📍 Found ${locationsData.locations.length} location(s):\n`);

        locationsData.locations.forEach((location, index) => {
          console.log(`   ${index + 1}. ${location.title || 'Unnamed Location'}`);
          console.log(`      Location ID: ${location.name}`);

          if (location.storefrontAddress) {
            const addr = location.storefrontAddress;
            const addressLine = [
              addr.addressLines?.[0],
              addr.locality,
              addr.administrativeArea,
              addr.postalCode
            ].filter(Boolean).join(', ');
            console.log(`      Address: ${addressLine}`);
          }

          console.log('');
        });

      } catch (error) {
        console.log(`   ❌ Error fetching locations: ${error.message}\n`);
      }

      console.log('─'.repeat(80));
    }

    console.log('\n✨ Done! Copy the "Location ID" values to your clients.json file.\n');
    console.log('📝 Format: "gbpLocationId": "accounts/XXXX/locations/YYYY"\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are set in .env');
    console.log('2. Enable "My Business Account Management API" in Google Cloud Console');
    console.log('3. Enable "My Business Business Information API" in Google Cloud Console');
    console.log('4. Add your service account email as a manager in Google Business Profile');
    console.log('\n📖 See GOOGLE_BUSINESS_PROFILE_SETUP.md for detailed instructions\n');
  }
}

// Run the script
getGBPLocations();
