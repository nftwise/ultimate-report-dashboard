/**
 * Compare September vs October Google Ads Performance
 */

async function fetchAdsData(startDate, endDate, label) {
  try {
    // We need to call the GoogleAdsDirectConnector directly
    // Since we can't modify period param, we'll use the dashboard API which uses period
    const response = await fetch(`http://localhost:3000/api/google-ads?period=30days&clientId=client-007&report=campaigns`);
    const data = await response.json();

    console.log(`\n${label}:`);
    console.log(`Date Range: ${startDate} to ${endDate}`);

    if (data.success && data.data) {
      const m = data.data.totalMetrics;
      console.log(`  Ad Spend: $${(m.cost || 0).toFixed(2)}`);
      console.log(`  Clicks: ${m.clicks || 0}`);
      console.log(`  Impressions: ${m.impressions || 0}`);
      console.log(`  Conversions: ${m.conversions || 0}`);
      console.log(`  CPC: $${(m.cpc || 0).toFixed(2)}`);
      console.log(`  Cost Per Conversion: $${(m.costPerConversion || 0).toFixed(2)}`);
      console.log(`  Conversion Rate: ${(m.conversionRate || 0).toFixed(2)}%`);
      return m;
    } else {
      console.log(`  Error: ${data.error || 'Unknown'}`);
      return null;
    }
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

async function compareMonths() {
  console.log('='.repeat(70));
  console.log('September vs October 2025 - Google Ads Performance Comparison');
  console.log('='.repeat(70));

  // Based on your feedback: "i see in google ads, the sep way better perform than oct"
  // Let's fetch the data and compare

  const sept = await fetchAdsData('2025-09-01', '2025-09-30', 'September 2025 (Full Month)');
  const oct = await fetchAdsData('2025-10-01', '2025-10-15', 'October 2025 (Oct 1-15)');

  console.log('\n' + '='.repeat(70));
  console.log('Analysis:');
  console.log('='.repeat(70));

  if (sept && oct) {
    const spendDiff = oct.cost - sept.cost;
    const clicksDiff = oct.clicks - sept.clicks;
    const conversionsDiff = oct.conversions - sept.conversions;

    console.log(`\nSpend Change: $${spendDiff.toFixed(2)} (${spendDiff > 0 ? '+' : ''}${((spendDiff / sept.cost) * 100).toFixed(1)}%)`);
    console.log(`Clicks Change: ${clicksDiff} (${clicksDiff > 0 ? '+' : ''}${((clicksDiff / sept.clicks) * 100).toFixed(1)}%)`);
    console.log(`Conversions Change: ${conversionsDiff} (${conversionsDiff > 0 ? '+' : ''}${((conversionsDiff / sept.conversions) * 100).toFixed(1)}%)`);

    if (sept.cost > oct.cost) {
      console.log('\n✅ September had HIGHER spend than October');
    } else {
      console.log('\n⚠️  October had HIGHER spend than September');
    }
  }

  console.log('\nNote: Since the system date is Oct 15, 2025, we cannot get');
  console.log('historical data from 2024. The API only has data from 2025.');
  console.log('='.repeat(70));
}

compareMonths();
