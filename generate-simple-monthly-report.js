/**
 * Generate Simple Monthly Report with REAL DATA
 * Fetches actual data from APIs and formats it in a simple text layout
 */

async function fetchMonthlyData() {
  try {
    // Fetch monthly comparison (Sept vs Oct)
    const monthlyResponse = await fetch('http://localhost:3000/api/reports/monthly?clientId=client-007');
    const monthlyData = await monthlyResponse.json();

    // Fetch historical data (6 months)
    const historicalResponse = await fetch('http://localhost:3000/api/reports/historical?clientId=client-007&months=6');
    const historicalData = await historicalResponse.json();

    // Fetch dashboard data for current period
    const dashboardResponse = await fetch('http://localhost:3000/api/dashboard?clientId=client-007&period=30d');
    const dashboardData = await dashboardResponse.json();

    if (!monthlyData.success || !historicalData.success || !dashboardData.success) {
      throw new Error('Failed to fetch data');
    }

    return {
      monthly: monthlyData.data,
      historical: historicalData.data,
      dashboard: dashboardData.data
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

function generateReport(data) {
  const { monthly, historical, dashboard } = data;

  const oct = monthly.googleAds.october;
  const sept = monthly.googleAds.september;
  const octGA = monthly.analytics.october;
  const septGA = monthly.analytics.september;
  const changes = monthly.googleAds.changes;
  const gaChanges = monthly.analytics.changes;

  console.log('═'.repeat(80));
  console.log('               YOUR MONTHLY PERFORMANCE REPORT');
  console.log('            October 1-15, 2025 vs September 1-15, 2025');
  console.log('═'.repeat(80));
  console.log('');

  // Biggest Win
  console.log('━'.repeat(80));
  console.log('🎯 THIS PERIOD\'S BIGGEST WIN');
  console.log('━'.repeat(80));

  const biggestWin = octGA.conversions > septGA.conversions
    ? `${octGA.conversions} Total Leads Generated! (+${gaChanges.conversions}% vs last period)`
    : `${oct.clicks} Ad Clicks Generated (+${changes.clicks}% vs last period)`;

  console.log(biggestWin);
  console.log('');

  // Month Comparison
  console.log('━'.repeat(80));
  console.log('📊 PERIOD COMPARISON (First 15 Days)');
  console.log('━'.repeat(80));
  console.log(`${'Metric'.padEnd(25)} ${'This Period'.padEnd(15)} ${'Last Period'.padEnd(15)} ${'Change'.padEnd(10)}`);
  console.log('─'.repeat(80));
  console.log(`${'Leads'.padEnd(25)} ${String(octGA.conversions).padEnd(15)} ${String(septGA.conversions).padEnd(15)} ${gaChanges.conversions > 0 ? '+' : ''}${gaChanges.conversions}%`);
  console.log(`${'Traffic (Sessions)'.padEnd(25)} ${String(octGA.sessions).padEnd(15)} ${String(septGA.sessions).padEnd(15)} ${gaChanges.sessions > 0 ? '+' : ''}${gaChanges.sessions}%`);
  console.log(`${'Users'.padEnd(25)} ${String(octGA.users).padEnd(15)} ${String(septGA.users).padEnd(15)} ${gaChanges.users > 0 ? '+' : ''}${gaChanges.users}%`);
  console.log(`${'Ad Clicks'.padEnd(25)} ${String(oct.clicks).padEnd(15)} ${String(sept.clicks).padEnd(15)} ${changes.clicks > 0 ? '+' : ''}${changes.clicks}%`);
  console.log(`${'Ad Spend'.padEnd(25)} ${'$' + oct.spend.toFixed(2).padEnd(14)} ${'$' + sept.spend.toFixed(2).padEnd(14)} ${changes.spend}%`);
  console.log(`${'Cost Per Lead'.padEnd(25)} ${'$' + oct.costPerConversion.toFixed(2).padEnd(14)} ${'$' + sept.costPerConversion.toFixed(2).padEnd(14)} ${changes.costPerConversion > 0 ? '+' : ''}${changes.costPerConversion}%`);
  console.log(`${'Conversion Rate'.padEnd(25)} ${oct.conversionRate.toFixed(1) + '%'.padEnd(14)} ${sept.conversionRate.toFixed(1) + '%'.padEnd(14)} ${(oct.conversionRate - sept.conversionRate).toFixed(1)}pts`);
  console.log('');

  // 6-Month Trend
  console.log('━'.repeat(80));
  console.log('📈 6-MONTH LEAD TREND');
  console.log('━'.repeat(80));

  historical.months.forEach(month => {
    const bar = '█'.repeat(Math.max(1, Math.floor(month.leads / 2)));
    const label = month.monthLabel.padEnd(12);
    const leadsStr = String(month.leads).padStart(2);
    const tag = month.monthLabel.includes('Oct') ? '📍 Current' :
                month.monthLabel.includes('Sep') ? '⭐ Peak' :
                month.leads === historical.insights.bestMonth.leads ? '🏆 Best' : '';

    console.log(`${label} ${leadsStr} leads: ${bar} ${tag}`);
  });

  console.log('');
  console.log(`Total Leads (6 months): ${historical.insights.totalLeads}`);
  console.log(`Average per Month: ${historical.insights.avgLeadsPerMonth} leads`);
  console.log(`Best Month: ${historical.insights.bestMonth.month} (${historical.insights.bestMonth.leads} leads)`);
  console.log('');

  // Campaign Performance
  console.log('━'.repeat(80));
  console.log('💰 TOP AD CAMPAIGNS (October 1-15)');
  console.log('━'.repeat(80));

  const octCampaigns = monthly.campaigns.october
    .filter(c => c.metrics.cost > 0)
    .sort((a, b) => b.metrics.cost - a.metrics.cost)
    .slice(0, 5);

  console.log(`${'Campaign'.padEnd(30)} ${'Spend'.padEnd(12)} ${'Clicks'.padEnd(8)} ${'Conv'.padEnd(8)} ${'CPL'.padEnd(10)}`);
  console.log('─'.repeat(80));

  octCampaigns.forEach(campaign => {
    const name = campaign.name.substring(0, 29).padEnd(30);
    const spend = ('$' + campaign.metrics.cost.toFixed(2)).padEnd(12);
    const clicks = String(campaign.metrics.clicks).padEnd(8);
    const conv = String(campaign.metrics.conversions.toFixed(0)).padEnd(8);
    const cpl = campaign.metrics.conversions > 0
      ? ('$' + campaign.metrics.costPerLead.toFixed(2)).padEnd(10)
      : 'N/A'.padEnd(10);

    console.log(`${name} ${spend} ${clicks} ${conv} ${cpl}`);
  });

  console.log('');
  console.log(`Total Spend: $${oct.spend.toFixed(2)}`);
  console.log(`Total Conversions: ${oct.conversions.toFixed(0)}`);
  console.log(`Overall Cost Per Lead: $${oct.costPerConversion.toFixed(2)}`);
  console.log('');

  // Search Console Performance
  if (dashboard.searchConsole) {
    console.log('━'.repeat(80));
    console.log('🏆 SEARCH PERFORMANCE (Last 30 Days)');
    console.log('━'.repeat(80));

    const sc = dashboard.searchConsole;
    console.log(`Total Clicks: ${sc.totals?.clicks || 0}`);
    console.log(`Total Impressions: ${(sc.totals?.impressions || 0).toLocaleString()}`);
    console.log(`Average CTR: ${(sc.totals?.ctr || 0).toFixed(2)}%`);
    console.log(`Average Position: ${(sc.totals?.position || 0).toFixed(1)}`);
    console.log('');

    if (sc.topQueries && sc.topQueries.length > 0) {
      console.log('Top Ranking Keywords:');
      sc.topQueries.slice(0, 5).forEach((query, i) => {
        console.log(`  #${query.position.toFixed(0)} - ${query.query} (${query.clicks} clicks)`);
      });
    }
    console.log('');
  }

  // Key Insights
  console.log('━'.repeat(80));
  console.log('💡 KEY INSIGHTS');
  console.log('━'.repeat(80));

  const insights = [];

  // Insight 1: Conversion rate
  if (changes.conversions !== 0) {
    const direction = changes.conversions > 0 ? 'improved' : 'decreased';
    insights.push(`1. Conversions ${direction} ${Math.abs(changes.conversions)}% period-over-period`);
  }

  // Insight 2: Cost efficiency
  if (changes.costPerConversion !== 0) {
    const direction = changes.costPerConversion > 0 ? 'increased' : 'decreased';
    insights.push(`2. Cost per lead ${direction} ${Math.abs(changes.costPerConversion)}% to $${oct.costPerConversion.toFixed(2)}`);
  }

  // Insight 3: CPC
  if (changes.cpc !== 0) {
    const direction = changes.cpc > 0 ? 'increased' : 'decreased';
    insights.push(`3. Cost per click ${direction} ${Math.abs(changes.cpc)}% to $${oct.cpc.toFixed(2)}`);
  }

  // Insight 4: Best campaign
  if (octCampaigns.length > 0) {
    const bestCampaign = octCampaigns.reduce((best, current) => {
      const bestCPL = best.metrics.conversions > 0 ? best.metrics.cost / best.metrics.conversions : Infinity;
      const currentCPL = current.metrics.conversions > 0 ? current.metrics.cost / current.metrics.conversions : Infinity;
      return currentCPL < bestCPL ? current : best;
    });

    if (bestCampaign.metrics.conversions > 0) {
      insights.push(`4. "${bestCampaign.name}" is your most efficient campaign at $${bestCampaign.metrics.costPerLead.toFixed(2)} per lead`);
    }
  }

  // Insight 5: Overall trend
  const trend = historical.insights.trend.direction;
  if (trend !== 'flat') {
    insights.push(`5. Overall 6-month trend is ${trend} - ${historical.insights.trend.description.toLowerCase()}`);
  }

  insights.forEach(insight => console.log(insight));
  console.log('');

  console.log('═'.repeat(80));
  console.log('                          END OF REPORT');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📌 All data is REAL from Google Ads, Google Analytics, and Search Console APIs');
  console.log('📅 Report generated: ' + new Date().toLocaleString());
  console.log('');
}

async function main() {
  console.log('Fetching real data from APIs...\n');

  const data = await fetchMonthlyData();

  if (!data) {
    console.error('Failed to fetch data from APIs');
    return;
  }

  generateReport(data);
}

main().catch(console.error);
