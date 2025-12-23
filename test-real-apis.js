/**
 * Test script to verify real API connections with your 3 clients
 * Run this with: node test-real-apis.js
 */

const clients = [
  {
    name: "DeCarlo Chiropractic",
    owner: "Chris DeCarlo",
    googleAnalyticsPropertyId: "64999541",
    googleAdsCustomerId: "637-911-2944",
    searchConsoleSiteUrl: "https://decarlochiropractic.com"
  },
  {
    name: "CorePosture",
    owner: "Tyler Meier",
    googleAnalyticsPropertyId: "133696356",
    googleAdsCustomerId: "114-407-3048",
    searchConsoleSiteUrl: "https://coreposturechiropractic.com"
  },
  {
    name: "Zen Care Physical Medicine",
    owner: "Jay Kang",
    googleAnalyticsPropertyId: "42417986",
    googleAdsCustomerId: "502-248-5586",
    searchConsoleSiteUrl: "https://zencare.com"
  }
];

async function testAPIs() {
  console.log('\n🔍 Testing Real API Connections for Your 3 Clients\n');
  console.log('='.repeat(60));

  for (const client of clients) {
    console.log(`\n📊 Testing: ${client.name} (${client.owner})`);
    console.log('-'.repeat(60));

    // Test Google Analytics
    console.log(`\n1️⃣  Google Analytics (Property ID: ${client.googleAnalyticsPropertyId})`);
    try {
      const gaResponse = await fetch(`http://localhost:3000/api/google-analytics?period=7days&clientId=decarlo-chiro&propertyId=${client.googleAnalyticsPropertyId}`);
      const gaData = await gaResponse.json();

      if (gaData.success) {
        console.log('   ✅ Google Analytics API: Connected');
        console.log(`   📈 Sessions: ${gaData.data.metrics?.sessions || 0}`);
        console.log(`   👥 Users: ${gaData.data.metrics?.users || 0}`);
        console.log(`   🎯 Conversions: ${gaData.data.metrics?.conversions || 0}`);
      } else {
        console.log('   ❌ Google Analytics API: Failed');
        console.log(`   Error: ${gaData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ Google Analytics API: Connection error`);
      console.log(`   ${error.message}`);
    }

    // Test Google Ads
    console.log(`\n2️⃣  Google Ads (Customer ID: ${client.googleAdsCustomerId})`);
    try {
      const adsResponse = await fetch(`http://localhost:3000/api/google-ads?period=7days&customerId=${client.googleAdsCustomerId}`);
      const adsData = await adsResponse.json();

      if (adsData.success) {
        console.log('   ✅ Google Ads API: Connected');
        console.log(`   💰 Spend: $${adsData.data.totalMetrics?.cost || 0}`);
        console.log(`   👆 Clicks: ${adsData.data.totalMetrics?.clicks || 0}`);
        console.log(`   🎯 Conversions: ${adsData.data.totalMetrics?.conversions || 0}`);
        console.log(`   📊 Campaigns: ${adsData.data.campaigns?.length || 0}`);
      } else {
        console.log('   ❌ Google Ads API: Failed');
        console.log(`   Error: ${adsData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ Google Ads API: Connection error`);
      console.log(`   ${error.message}`);
    }

    // Test Search Console
    console.log(`\n3️⃣  Search Console (${client.searchConsoleSiteUrl})`);
    try {
      const scResponse = await fetch(`http://localhost:3000/api/search-console?period=7days&siteUrl=${encodeURIComponent(client.searchConsoleSiteUrl)}`);
      const scData = await scResponse.json();

      if (scData.success) {
        console.log('   ✅ Search Console API: Connected');
        console.log(`   👁️  Impressions: ${scData.data.totals?.impressions || 0}`);
        console.log(`   👆 Clicks: ${scData.data.totals?.clicks || 0}`);
        console.log(`   📊 CTR: ${((scData.data.totals?.avgCtr || 0) * 100).toFixed(2)}%`);
      } else {
        console.log('   ⚠️  Search Console API: Not connected or needs setup');
        console.log(`   Note: ${scData.error || 'This is optional and can be set up later'}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Search Console API: Connection error (optional)`);
      console.log(`   ${error.message}`);
    }

    console.log('\n' + '-'.repeat(60));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ API Testing Complete!\n');
  console.log('Next Steps:');
  console.log('  1. If all APIs show ✅ - You\'re ready to go!');
  console.log('  2. If any show ❌ - Check the error messages above');
  console.log('  3. Search Console ⚠️  is optional - can set up later');
  console.log('\n');
}

// Run the test
testAPIs().catch(console.error);
