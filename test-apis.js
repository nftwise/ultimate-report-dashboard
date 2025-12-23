#!/usr/bin/env node

/**
 * API Diagnostic Script for Ultimate Report Dashboard
 * Tests Google Ads and Search Console API connections
 */

require('dotenv').config({ path: '.env.local' });

const { GoogleAdsApi } = require('google-ads-api');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

console.log('\n🔍 API Diagnostic Tool\n');
console.log('='.repeat(80));

// Track results
const results = {
  googleAds: { success: false, errors: [] },
  searchConsole: { success: false, errors: [] }
};

// Test Google Ads API
async function testGoogleAds() {
  console.log('\n📊 Testing Google Ads API...\n');

  try {
    // Check environment variables
    const requiredVars = [
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_REFRESH_TOKEN'
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ All Google Ads environment variables present');

    // Initialize client
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    console.log('✅ Google Ads client initialized');

    // Test with customer ID from clients.json
    const testCustomerId = '2812810609';
    const mccId = process.env.GOOGLE_ADS_MCC_ID || '8432700368';

    console.log(`\n🔑 Testing Customer ID: ${testCustomerId}`);
    console.log(`🔑 MCC ID: ${mccId}`);

    const customer = client.Customer({
      customer_id: testCustomerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      login_customer_id: mccId
    });

    // Simple query to test access
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code
      FROM customer
      LIMIT 1
    `;

    console.log('\n⏳ Executing test query...');
    const queryResults = await Promise.race([
      customer.query(query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      )
    ]);

    if (queryResults && queryResults.length > 0) {
      console.log('✅ SUCCESS! Google Ads API is working');
      console.log(`   Customer: ${queryResults[0].customer.descriptive_name}`);
      console.log(`   Currency: ${queryResults[0].customer.currency_code}`);
      results.googleAds.success = true;
    } else {
      throw new Error('Query returned no results');
    }

  } catch (error) {
    console.log('❌ FAILED: Google Ads API test');
    console.log(`   Error: ${error.message}`);
    results.googleAds.errors.push(error.message);

    // Provide helpful recommendations
    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n💡 Recommendation: Permission denied');
      console.log('   - Verify the refresh token has access to this account');
      console.log('   - Check if you can see this account at https://ads.google.com');
      console.log('   - Ensure you have Admin or Standard (edit) access');
    } else if (error.message.includes('AUTHENTICATION_ERROR')) {
      console.log('\n💡 Recommendation: Authentication error');
      console.log('   - Refresh token may be expired or invalid');
      console.log('   - Regenerate token using OAuth Playground');
      console.log('   - Scope: https://www.googleapis.com/auth/adwords');
    } else if (error.message.includes('developer token')) {
      console.log('\n💡 Recommendation: Developer token issue');
      console.log('   - Basic Access has limitations');
      console.log('   - Apply for Standard Access at: https://ads.google.com/aw/apicenter');
    }
  }
}

// Test Search Console API
async function testSearchConsole() {
  console.log('\n🔍 Testing Google Search Console API...\n');

  try {
    // Check environment variables
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'https://mychiropractice.com';

    if (!privateKey || !clientEmail) {
      throw new Error('Missing Google service account credentials (GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL)');
    }

    console.log('✅ Service account credentials present');
    console.log(`📍 Testing site: ${siteUrl}`);

    // Create JWT auth
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    console.log('\n⏳ Listing accessible sites...');
    const sitesResponse = await searchconsole.sites.list();

    if (sitesResponse.data.siteEntry && sitesResponse.data.siteEntry.length > 0) {
      console.log('✅ SUCCESS! Search Console API is working');
      console.log(`   Found ${sitesResponse.data.siteEntry.length} accessible site(s):`);
      sitesResponse.data.siteEntry.forEach(site => {
        console.log(`   - ${site.siteUrl} (${site.permissionLevel})`);
      });
      results.searchConsole.success = true;

      // Test if our configured site is in the list
      const hasSite = sitesResponse.data.siteEntry.some(site =>
        site.siteUrl === siteUrl || site.siteUrl === siteUrl + '/'
      );

      if (!hasSite) {
        console.log(`\n⚠️  WARNING: Configured site "${siteUrl}" not found in accessible sites`);
        console.log('   Update GOOGLE_SEARCH_CONSOLE_SITE_URL to match one of the sites above');
      } else {
        console.log(`\n✅ Configured site "${siteUrl}" is accessible`);

        // Try a simple query
        console.log('\n⏳ Testing search analytics query...');
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);

        try {
          const analyticsResponse = await searchconsole.searchanalytics.query({
            siteUrl: siteUrl,
            requestBody: {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              dimensions: ['date'],
              rowLimit: 10
            }
          });

          console.log('✅ Search analytics query successful');
          if (analyticsResponse.data.rows && analyticsResponse.data.rows.length > 0) {
            console.log(`   Found ${analyticsResponse.data.rows.length} days of data`);
          } else {
            console.log('   No data found for date range (site may be new or have no traffic)');
          }
        } catch (queryError) {
          console.log(`⚠️  Search analytics query failed: ${queryError.message}`);
        }
      }
    } else {
      throw new Error('No accessible sites found');
    }

  } catch (error) {
    console.log('❌ FAILED: Search Console API test');
    console.log(`   Error: ${error.message}`);
    results.searchConsole.errors.push(error.message);

    // Provide helpful recommendations
    if (error.message.includes('403') || error.message.includes('permission')) {
      console.log('\n💡 Recommendation: Permission denied');
      console.log('   - Add service account email to Search Console');
      console.log(`   - Email: ${process.env.GOOGLE_CLIENT_EMAIL}`);
      console.log('   - Go to: https://search.google.com/search-console');
      console.log('   - Settings → Users and permissions → Add user');
      console.log('   - Grant at least "Full" permission');
    } else if (error.message.includes('credentials')) {
      console.log('\n💡 Recommendation: Invalid credentials');
      console.log('   - Check GOOGLE_PRIVATE_KEY is correctly formatted');
      console.log('   - Ensure all \\n are in the key');
      console.log('   - Verify GOOGLE_CLIENT_EMAIL matches service account');
    }
  }
}

// Main execution
async function runDiagnostics() {
  console.log('Environment Variables Check:');
  console.log('✓ GOOGLE_ADS_DEVELOPER_TOKEN:', process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_ADS_CLIENT_ID:', process.env.GOOGLE_ADS_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_ADS_CLIENT_SECRET:', process.env.GOOGLE_ADS_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_ADS_REFRESH_TOKEN:', process.env.GOOGLE_ADS_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_ADS_MCC_ID:', process.env.GOOGLE_ADS_MCC_ID ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_SEARCH_CONSOLE_SITE_URL:', process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ? '✅ Set' : '❌ Missing');

  await testGoogleAds();
  await testSearchConsole();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 DIAGNOSTIC SUMMARY\n');
  console.log(`Google Ads API:        ${results.googleAds.success ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Search Console API:    ${results.searchConsole.success ? '✅ WORKING' : '❌ FAILED'}`);

  if (!results.googleAds.success || !results.searchConsole.success) {
    console.log('\n❌ ACTION REQUIRED:');
    if (!results.googleAds.success) {
      console.log('\n   Google Ads Issues:');
      results.googleAds.errors.forEach(err => console.log(`   - ${err}`));
    }
    if (!results.searchConsole.success) {
      console.log('\n   Search Console Issues:');
      results.searchConsole.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('\n💡 Fix these issues before deploying to Vercel');
  } else {
    console.log('\n✅ All APIs working! Ready to deploy to Vercel');
    console.log('\n📦 Next steps:');
    console.log('   1. Verify Vercel environment variables match .env.local');
    console.log('   2. Deploy: npx vercel --prod');
    console.log('   3. Test on live URL');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

runDiagnostics().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
