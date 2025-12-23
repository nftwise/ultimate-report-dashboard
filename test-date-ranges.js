const baseUrl = 'http://localhost:3000';

async function testDateRange(label, startDate, endDate) {
  try {
    const url = `${baseUrl}/api/google-ads?period=custom&clientId=client-007`;
    console.log(`\n${label}:`);
    console.log(`Fetching: ${url}`);
    console.log(`Date range: ${startDate} to ${endDate}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      console.log('✅ Success!');
      console.log('Total Metrics:');
      console.log('  Spend: $' + data.data.totalMetrics.cost.toFixed(2));
      console.log('  Clicks:', data.data.totalMetrics.clicks);
      console.log('  Impressions:', data.data.totalMetrics.impressions);
      console.log('  Conversions:', data.data.totalMetrics.conversions);
      console.log('  Campaigns:', data.data.campaigns.length);
    } else {
      console.log('❌ Failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function runTests() {
  console.log('Testing Google Ads API Date Ranges\n');
  console.log('='.repeat(50));

  await testDateRange('September 2024 (Full Month)', '2024-09-01', '2024-09-30');
  await testDateRange('October 2024 (Oct 1-15)', '2024-10-01', '2024-10-15');
  await testDateRange('Last 7 days',
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );
  await testDateRange('Last 30 days',
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );

  console.log('\n' + '='.repeat(50));
  console.log('\nNote: The API currently uses period parameter.');
  console.log('To test custom date ranges, we need to update the API endpoint.');
}

runTests();
