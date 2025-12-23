#!/usr/bin/env node

/**
 * Diagnose Google Ads API 401 Authentication Issue
 * Test locally to identify the specific problem
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function diagnoseAuthIssue() {
  console.log('\n🔍 Diagnosing Google Ads API 401 Error\n');
  console.log('='.repeat(80));

  // Test 1: Check environment variables
  console.log('\n✅ Test 1: Environment Variables');
  console.log('GOOGLE_ADS_DEVELOPER_TOKEN:', process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_ADS_CLIENT_ID:', process.env.GOOGLE_ADS_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_ADS_CLIENT_SECRET:', process.env.GOOGLE_ADS_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_ADS_REFRESH_TOKEN:', process.env.GOOGLE_ADS_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_ADS_MCC_ID:', process.env.GOOGLE_ADS_MCC_ID || '❌ Not set');

  // Test 2: Initialize client
  console.log('\n✅ Test 2: Initialize Google Ads Client');
  let client;
  try {
    client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    console.log('✅ Client initialized successfully');
  } catch (error) {
    console.log('❌ Failed to initialize client:', error.message);
    return;
  }

  // Test 3: Test with MCC ID (login_customer_id)
  console.log('\n✅ Test 3: Test with MCC Account');
  const customerId = '2812810609';
  const mccId = process.env.GOOGLE_ADS_MCC_ID || '8432700368';

  try {
    const customerWithMCC = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      login_customer_id: mccId
    });

    console.log(`Testing query with MCC: ${mccId} -> Customer: ${customerId}`);

    const query = `
      SELECT
        customer.id,
        customer.descriptive_name
      FROM customer
      LIMIT 1
    `;

    const result = await customerWithMCC.query(query);
    console.log('✅ SUCCESS with MCC ID!');
    console.log('   Customer:', result[0]?.customer?.descriptive_name);
  } catch (error) {
    console.log('❌ FAILED with MCC ID');
    console.log('   Error:', error.message);
    console.log('   Error code:', error.code);

    // Analyze the error
    if (error.message.includes('UNAUTHENTICATED') || error.message.includes('401')) {
      console.log('\n💡 DIAGNOSIS: OAuth Token Issue');
      console.log('   The refresh token is not valid or has expired');
      console.log('\n   SOLUTION:');
      console.log('   1. Go to: https://developers.google.com/oauthplayground/');
      console.log('   2. Click gear icon → Use your own OAuth credentials');
      console.log('   3. Enter your Client ID and Client Secret');
      console.log('   4. In Step 1, select: Google Ads API v15 → https://www.googleapis.com/auth/adwords');
      console.log('   5. Click "Authorize APIs"');
      console.log('   6. Login with the Google account that has access to the Ads account');
      console.log('   7. Click "Exchange authorization code for tokens"');
      console.log('   8. Copy the Refresh Token');
      console.log('   9. Update GOOGLE_ADS_REFRESH_TOKEN in .env.local and Vercel');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n💡 DIAGNOSIS: MCC Permissions Issue');
      console.log('   The refresh token account does not have access to this customer via MCC');
      console.log('\n   SOLUTION:');
      console.log('   1. Login to https://ads.google.com with the account used for refresh token');
      console.log('   2. Check if you can see customer 2812810609 in the account selector');
      console.log('   3. If not, get Admin access added to the account');
      console.log('   4. Or regenerate refresh token with an account that has access');
    } else if (error.message.includes('developer_token')) {
      console.log('\n💡 DIAGNOSIS: Developer Token Issue');
      console.log('   Basic Access developer token has restrictions');
      console.log('\n   SOLUTION:');
      console.log('   1. Apply for Standard Access at: https://ads.google.com/aw/apicenter');
      console.log('   2. Or use test account during Basic Access');
    }
  }

  // Test 4: Test without MCC ID
  console.log('\n✅ Test 4: Test WITHOUT MCC Account (direct access)');
  try {
    const customerDirect = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });

    const query = `
      SELECT
        customer.id,
        customer.descriptive_name
      FROM customer
      LIMIT 1
    `;

    const result = await customerDirect.query(query);
    console.log('✅ SUCCESS without MCC ID!');
    console.log('   This means the issue is MCC-related');
    console.log('   Customer:', result[0]?.customer?.descriptive_name);

    console.log('\n💡 SOLUTION: Remove MCC ID from configuration');
    console.log('   The account can be accessed directly without MCC');
  } catch (error) {
    console.log('❌ FAILED without MCC ID too');
    console.log('   Error:', error.message);
  }

  // Test 5: Check token freshness
  console.log('\n✅ Test 5: Token Validation');
  console.log('Refresh Token (first 20 chars):', process.env.GOOGLE_ADS_REFRESH_TOKEN?.substring(0, 20) + '...');
  console.log('Token format check:', process.env.GOOGLE_ADS_REFRESH_TOKEN?.startsWith('1//') ? '✅ Valid format' : '⚠️  Unusual format');

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 DIAGNOSIS COMPLETE\n');
  console.log('Based on the tests above, the 401 error is most likely caused by:');
  console.log('\n1. OAuth Refresh Token Issue (Most Common)');
  console.log('   - Token expired or revoked');
  console.log('   - Token generated with wrong Google account');
  console.log('   - Solution: Regenerate refresh token\n');
  console.log('2. MCC Access Configuration');
  console.log('   - Token account lacks MCC access');
  console.log('   - Wrong MCC ID');
  console.log('   - Solution: Fix MCC ID or remove it\n');
  console.log('3. Developer Token Access Level');
  console.log('   - Basic Access has limitations');
  console.log('   - Solution: Apply for Standard Access\n');
  console.log('='.repeat(80) + '\n');
}

diagnoseAuthIssue().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
