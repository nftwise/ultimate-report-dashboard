// Test script to check Google Ads historical data
const fetch = require('node-fetch');

const clientId = 'client-007'; // My Chiropractic Practice

async function testHistoricalAPI() {
  console.log('🔍 Testing Historical API for client:', clientId);
  console.log('==================================================\n');

  try {
    // Test locally first
    const localUrl = `http://localhost:3000/api/reports/historical?clientId=${clientId}&months=6`;
    console.log('Testing LOCAL API:', localUrl);

    const response = await fetch(localUrl);
    const data = await response.json();

    console.log('\n📊 Response Status:', response.status);
    console.log('📊 Response Headers:', response.headers.get('content-type'));

    if (data.success) {
      console.log('\n✅ SUCCESS - Data retrieved!\n');
      console.log('Total Leads (6 months):', data.data.insights.totalLeads);
      console.log('Total Spend:', data.data.insights.totalSpend);
      console.log('Average Leads per Month:', data.data.insights.avgLeadsPerMonth);
      console.log('\nMonthly Breakdown:');
      data.data.months.forEach(month => {
        console.log(`  ${month.monthLabel}: ${month.leads} leads, $${month.adSpend.toFixed(2)} spend`);
      });
    } else {
      console.log('\n❌ ERROR - API returned failure');
      console.log('Error message:', data.error);
    }

    console.log('\n📄 Full Response:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/dashboard?period=7days&clientId=client-007');
    if (response.ok) {
      console.log('✅ Server is running on localhost:3000\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is NOT running on localhost:3000');
    console.log('💡 Please start the dev server first: npm run dev\n');
    return false;
  }
}

async function main() {
  const isRunning = await checkServer();
  if (isRunning) {
    await testHistoricalAPI();
  }
}

main();
