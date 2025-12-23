/**
 * Test Google Ads API with different date ranges
 * This will help us understand what real data is available
 */

async function testGoogleAdsAPI() {
  const baseUrl = 'http://localhost:3000/api/google-ads';

  const tests = [
    { label: 'Last 7 days', period: '7days' },
    { label: 'Last 30 days', period: '30days' },
    { label: 'Last 90 days', period: '90days' },
  ];

  console.log('Google Ads API Date Range Testing');
  console.log('='.repeat(70));
  console.log('');

  for (const test of tests) {
    try {
      const url = `${baseUrl}?period=${test.period}&clientId=client-007&report=campaigns`;
      console.log(`Testing: ${test.label} (${test.period})`);
      console.log(`URL: ${url}`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data) {
        const metrics = data.data.totalMetrics;
        const campaigns = data.data.campaigns || [];

        console.log(`✅ Status: Success`);
        console.log(`   Total Spend: $${metrics.cost ? metrics.cost.toFixed(2) : '0.00'}`);
        console.log(`   Total Clicks: ${metrics.clicks || 0}`);
        console.log(`   Total Impressions: ${metrics.impressions || 0}`);
        console.log(`   Total Conversions: ${metrics.conversions || 0}`);
        console.log(`   Campaigns found: ${campaigns.length}`);

        if (campaigns.length > 0) {
          console.log(`   Top campaign: ${campaigns[0].name || campaigns[0].type}`);
          console.log(`     Spend: $${campaigns[0].metrics.cost.toFixed(2)}`);
          console.log(`     Clicks: ${campaigns[0].metrics.clicks}`);
        }

        // Check date range
        if (data.data.dateRange) {
          console.log(`   Date range: ${data.data.dateRange.startDate} to ${data.data.dateRange.endDate}`);
        }
      } else {
        console.log(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log('');
  }

  // Now let's test the weekly report to compare
  console.log('-'.repeat(70));
  console.log('Weekly Report API Test:');
  console.log('-'.repeat(70));

  try {
    const url = `${baseUrl.replace('/google-ads', '/reports/weekly')}?clientId=client-007`;
    console.log(`URL: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data) {
      const metrics = data.data.performanceMetrics;
      console.log(`✅ Weekly Report Success`);
      console.log(`   Period: ${data.data.weekPeriod.start} - ${data.data.weekPeriod.end}`);
      console.log(`   Total Leads: ${metrics.totalLeads} (${metrics.leadsChange > 0 ? '+' : ''}${metrics.leadsChange}%)`);
      console.log(`   Sessions: ${metrics.sessions} (${metrics.sessionsChange > 0 ? '+' : ''}${metrics.sessionsChange}%)`);
      console.log(`   Ad Spend: $${metrics.adSpend.toFixed(2)} (${metrics.adSpendChange > 0 ? '+' : ''}${metrics.adSpendChange}%)`);
      console.log(`   Ad Clicks: ${metrics.adClicks}`);
      console.log(`   Cost Per Lead: $${metrics.costPerLead.toFixed(2)}`);
    } else {
      console.log(`❌ Failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('Analysis:');
  console.log('If Ad Spend shows $0 in weekly report but has values in the');
  console.log('7-day/30-day tests, then the date range being passed to the');
  console.log('GoogleAdsDirectConnector in the weekly report route is incorrect.');
  console.log('='.repeat(70));
}

testGoogleAdsAPI().catch(console.error);
