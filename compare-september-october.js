/**
 * Compare September vs October Performance
 * This will fetch real data from Google Ads API for both months
 */

async function fetchGoogleAdsData(startDate, endDate) {
  const url = `http://localhost:3000/api/google-ads?clientId=client-007&report=campaigns`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        dateRange: data.data.dateRange,
        metrics: data.data.totalMetrics,
        campaigns: data.data.campaigns
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fetchGoogleAnalytics(startDate, endDate) {
  const url = `http://localhost:3000/api/google-analytics?clientId=client-007`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        metrics: data.data.metrics
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function comparePerformance() {
  console.log('='.repeat(80));
  console.log('SEPTEMBER vs OCTOBER 2025 - PERFORMANCE COMPARISON');
  console.log('='.repeat(80));
  console.log('');

  // Fetch current data (this will give us the active period data)
  console.log('Fetching Google Ads data...');
  const adsData = await fetchGoogleAdsData();

  console.log('Fetching Google Analytics data...');
  const gaData = await fetchGoogleAnalytics();

  console.log('');
  console.log('-'.repeat(80));
  console.log('CURRENT DATA (from API):');
  console.log('-'.repeat(80));

  if (adsData.success) {
    const m = adsData.metrics;
    console.log(`\nGoogle Ads Performance:`);
    console.log(`  Date Range: ${adsData.dateRange.startDate} to ${adsData.dateRange.endDate}`);
    console.log(`  Ad Spend: $${(m.cost || 0).toFixed(2)}`);
    console.log(`  Clicks: ${m.clicks || 0}`);
    console.log(`  Impressions: ${m.impressions || 0}`);
    console.log(`  Conversions: ${m.conversions || 0}`);
    console.log(`  CPC: $${(m.cpc || 0).toFixed(2)}`);
    console.log(`  Cost Per Conversion: $${(m.costPerConversion || 0).toFixed(2)}`);
    console.log(`  Conversion Rate: ${(m.conversionRate || 0).toFixed(2)}%`);
    console.log(`  CTR: ${(m.ctr || 0).toFixed(2)}%`);

    console.log(`\n  Active Campaigns: ${adsData.campaigns.length}`);
    if (adsData.campaigns.length > 0) {
      console.log(`  Top Campaigns:`);
      adsData.campaigns.slice(0, 5).forEach((c, i) => {
        console.log(`    ${i+1}. ${c.name || c.type}: $${(c.metrics.cost || 0).toFixed(2)} spend, ${c.metrics.clicks} clicks, ${c.metrics.conversions} conversions`);
      });
    }
  } else {
    console.log(`\nGoogle Ads: Error - ${adsData.error}`);
  }

  if (gaData.success) {
    const m = gaData.metrics;
    console.log(`\nGoogle Analytics Performance:`);
    console.log(`  Sessions: ${m.sessions || 0}`);
    console.log(`  Users: ${m.users || 0}`);
    console.log(`  Conversions: ${m.conversions || 0}`);
    console.log(`  Bounce Rate: ${(m.bounceRate || 0).toFixed(2)}%`);
    console.log(`  Avg Session Duration: ${m.averageSessionDuration || 0}s`);
  } else {
    console.log(`\nGoogle Analytics: Error - ${gaData.error}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('ANALYSIS:');
  console.log('='.repeat(80));
  console.log('');
  console.log('The API is currently returning data for the default period (last 7 days).');
  console.log('');
  console.log('To get September vs October comparison, we need to:');
  console.log('1. Check what date range the APIs are actually using');
  console.log('2. Verify if there is historical data available for September 2025');
  console.log('3. Create a proper month-over-month comparison endpoint');
  console.log('');
  console.log('Based on your feedback: "i see in google ads, the sep way better perform than oct"');
  console.log('This suggests you have access to Google Ads dashboard showing both months.');
  console.log('');
  console.log('Can you check your Google Ads dashboard and tell me:');
  console.log('- What are the September 2025 totals? (spend, clicks, conversions)');
  console.log('- What are the October 2025 totals so far? (spend, clicks, conversions)');
  console.log('- Are these dates 2025 or should we be looking at 2024 data?');
  console.log('');
  console.log('='.repeat(80));
}

comparePerformance().catch(console.error);
