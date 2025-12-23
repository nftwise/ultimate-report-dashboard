/**
 * Test the new historical data fetcher
 * This will show us if we can get the real September data (26 leads)
 */

const { GoogleAdsHistoricalFetcher } = require('./src/lib/google-ads-historical.ts');

async function testHistoricalData() {
  console.log('═'.repeat(80));
  console.log('TESTING GOOGLE ADS HISTORICAL DATA FETCHER');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Load client config
    const fs = require('fs');
    const clientsData = JSON.parse(fs.readFileSync('./src/data/clients.json', 'utf8'));
    const client = clientsData.clients.find(c => c.id === 'client-007');

    if (!client) {
      throw new Error('Client not found');
    }

    console.log('Client:', client.companyName);
    console.log('Customer ID:', client.googleAdsCustomerId);
    console.log('MCC ID:', client.googleAdsMccId);
    console.log('');

    const fetcher = new GoogleAdsHistoricalFetcher();

    // Test 1: Get September 2025 data
    console.log('━'.repeat(80));
    console.log('TEST 1: September 2025 (Full Month)');
    console.log('━'.repeat(80));

    const septData = await fetcher.getMonthData(
      client.googleAdsCustomerId,
      2025,
      9,
      client.googleAdsMccId
    );

    console.log('');
    console.log('SEPTEMBER RESULTS:');
    console.log('  Total Conversions:', septData.totalConversions);
    console.log('  Total Spend: $', septData.totalSpend.toFixed(2));
    console.log('  Total Clicks:', septData.totalClicks);
    console.log('  Avg CPC: $', septData.avgCpc.toFixed(2));
    console.log('  Conversion Rate:', septData.conversionRate.toFixed(2), '%');
    console.log('  Days of data:', septData.dailyData.length);
    console.log('');

    // Show week 1 specifically
    const week1Data = septData.dailyData.filter(d => {
      const day = parseInt(d.date.substring(6, 8));
      return day >= 1 && day <= 7;
    });

    const week1Conversions = week1Data.reduce((sum, d) => sum + d.conversions, 0);
    const week1Spend = week1Data.reduce((sum, d) => sum + d.spend, 0);

    console.log('SEPTEMBER WEEK 1 (Sept 1-7):');
    console.log('  Conversions:', week1Conversions, '(You said 26 in dashboard)');
    console.log('  Spend: $', week1Spend.toFixed(2));
    console.log('  Days:', week1Data.length);
    console.log('');

    // Show daily breakdown for first week
    console.log('Daily breakdown:');
    week1Data.forEach(day => {
      const dateStr = `${day.date.substring(0, 4)}-${day.date.substring(4, 6)}-${day.date.substring(6, 8)}`;
      console.log(`  ${dateStr}: ${day.conversions.toFixed(1)} conversions, $${day.spend.toFixed(2)}`);
    });
    console.log('');

    // Show campaigns
    console.log('TOP CAMPAIGNS (September):');
    const topCampaigns = septData.campaigns
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);

    topCampaigns.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name}: ${c.conversions.toFixed(0)} conv, $${c.spend.toFixed(2)}`);
    });
    console.log('');

    // Test 2: Get October 2025 data
    console.log('━'.repeat(80));
    console.log('TEST 2: October 2025 (Oct 1-15)');
    console.log('━'.repeat(80));

    const octStart = '2025-10-01';
    const octEnd = '2025-10-15';

    const octDailyData = await fetcher.getSixMonthsData(
      client.googleAdsCustomerId,
      client.googleAdsMccId,
      octStart,
      octEnd
    );

    const octConversions = octDailyData.reduce((sum, d) => sum + d.conversions, 0);
    const octSpend = octDailyData.reduce((sum, d) => sum + d.spend, 0);

    console.log('');
    console.log('OCTOBER 1-15 RESULTS:');
    console.log('  Total Conversions:', octConversions);
    console.log('  Total Spend: $', octSpend.toFixed(2));
    console.log('  Days of data:', octDailyData.length);
    console.log('');

    // Test 3: Compare Sept vs Oct
    console.log('━'.repeat(80));
    console.log('COMPARISON: September Week 1 vs October Week 1');
    console.log('━'.repeat(80));

    const octWeek1Data = octDailyData.filter(d => {
      const day = parseInt(d.date.substring(6, 8));
      return day >= 1 && day <= 7;
    });

    const octWeek1Conversions = octWeek1Data.reduce((sum, d) => sum + d.conversions, 0);

    console.log('');
    console.log(`September Week 1: ${week1Conversions.toFixed(0)} conversions`);
    console.log(`October Week 1:   ${octWeek1Conversions.toFixed(0)} conversions`);

    const change = week1Conversions > 0
      ? ((octWeek1Conversions - week1Conversions) / week1Conversions) * 100
      : 0;

    console.log(`Change: ${change > 0 ? '+' : ''}${change.toFixed(0)}%`);
    console.log('');

    console.log('═'.repeat(80));
    console.log('✅ TEST COMPLETE');
    console.log('═'.repeat(80));
    console.log('');
    console.log('EXPECTED: September Week 1 should show ~26 conversions');
    console.log(`ACTUAL:   September Week 1 shows ${week1Conversions.toFixed(0)} conversions`);
    console.log('');

    if (Math.abs(week1Conversions - 26) < 5) {
      console.log('✅ SUCCESS! Data matches your Google Ads dashboard!');
    } else {
      console.log('⚠️  Data does not match. Possible reasons:');
      console.log('   1. Different conversion actions being counted');
      console.log('   2. Attribution window differences');
      console.log('   3. Timezone mismatch');
      console.log('   4. Conversion import settings');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testHistoricalData();
