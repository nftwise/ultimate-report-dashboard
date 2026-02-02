#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tupedninjtaarmdwppgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeGBPAndGoogleAdsData() {
  try {
    console.log('🔍 Starting GBP and Google Ads Data Analysis...\n');

    // 1. Get all records from client_metrics_summary
    console.log('📊 Fetching all metric records...');
    const { data: allMetrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .order('date', { ascending: true });

    if (metricsError) {
      console.error('❌ Error fetching metrics:', metricsError);
      return;
    }

    console.log(`✅ Retrieved ${allMetrics.length} total records\n`);

    // 2. Analyze GBP calls data
    console.log('=' .repeat(80));
    console.log('1️⃣  GBP CALLS DATA ANALYSIS');
    console.log('=' .repeat(80));

    const gbpNonZeroRecords = allMetrics.filter(m => m.gbp_calls && m.gbp_calls > 0);
    console.log(`\n📞 Records with GBP Calls > 0: ${gbpNonZeroRecords.length}`);
    console.log(`📞 Records with GBP Calls = 0: ${allMetrics.length - gbpNonZeroRecords.length}`);
    console.log(`📞 Percentage with data: ${(gbpNonZeroRecords.length / allMetrics.length * 100).toFixed(2)}%`);

    // 3. Analyze Google Ads data
    console.log('\n' + '=' .repeat(80));
    console.log('2️⃣  GOOGLE ADS DATA ANALYSIS');
    console.log('=' .repeat(80));

    const adsConvNonZero = allMetrics.filter(m => m.google_ads_conversions && m.google_ads_conversions > 0);
    const adsImpNonZero = allMetrics.filter(m => m.ads_impressions && m.ads_impressions > 0);
    const adsClicksNonZero = allMetrics.filter(m => m.ads_clicks && m.ads_clicks > 0);

    console.log(`\n🎯 Google Ads Conversions > 0: ${adsConvNonZero.length} records`);
    console.log(`📊 Ads Impressions > 0: ${adsImpNonZero.length} records`);
    console.log(`🖱️  Ads Clicks > 0: ${adsClicksNonZero.length} records`);

    // 4. Date range coverage
    console.log('\n' + '=' .repeat(80));
    console.log('3️⃣  DATE RANGE COVERAGE');
    console.log('=' .repeat(80));

    // GBP date range
    const gbpDateRecords = allMetrics.filter(m => m.gbp_calls && m.gbp_calls > 0);
    if (gbpDateRecords.length > 0) {
      const gbpDates = gbpDateRecords.map(m => new Date(m.date)).sort((a, b) => a - b);
      const gbpEarliest = gbpDates[0];
      const gbpLatest = gbpDates[gbpDates.length - 1];
      console.log(`\n📞 GBP Data Date Range:`);
      console.log(`   Earliest: ${gbpEarliest.toISOString().split('T')[0]}`);
      console.log(`   Latest:   ${gbpLatest.toISOString().split('T')[0]}`);
      console.log(`   Days of data: ${Math.ceil((gbpLatest - gbpEarliest) / (1000 * 60 * 60 * 24))} days`);
    } else {
      console.log(`\n📞 GBP Data: NO DATA AVAILABLE (all records are 0)`);
    }

    // Ads date range
    const adsDateRecords = allMetrics.filter(m => (m.google_ads_conversions && m.google_ads_conversions > 0) || (m.ads_impressions && m.ads_impressions > 0));
    if (adsDateRecords.length > 0) {
      const adsDates = adsDateRecords.map(m => new Date(m.date)).sort((a, b) => a - b);
      const adsEarliest = adsDates[0];
      const adsLatest = adsDates[adsDates.length - 1];
      console.log(`\n🎯 Google Ads Data Date Range:`);
      console.log(`   Earliest: ${adsEarliest.toISOString().split('T')[0]}`);
      console.log(`   Latest:   ${adsLatest.toISOString().split('T')[0]}`);
      console.log(`   Days of data: ${Math.ceil((adsLatest - adsEarliest) / (1000 * 60 * 60 * 24))} days`);
    } else {
      console.log(`\n🎯 Google Ads Data: NO DATA AVAILABLE`);
    }

    // 5. By-client analysis
    console.log('\n' + '=' .repeat(80));
    console.log('4️⃣  CLIENT-LEVEL ANALYSIS');
    console.log('=' .repeat(80));

    // Group by client
    const clientMetrics = {};
    allMetrics.forEach(m => {
      if (!clientMetrics[m.client_id]) {
        clientMetrics[m.client_id] = {
          gbpCalls: 0,
          gbpCallsMax: 0,
          adsConversions: 0,
          adsConversionsMax: 0,
          adsImpressions: 0,
          adsImpressionsMax: 0,
          adsClicks: 0,
          adsClicksMax: 0,
          recordCount: 0,
          dates: []
        };
      }
      clientMetrics[m.client_id].gbpCalls += m.gbp_calls || 0;
      clientMetrics[m.client_id].gbpCallsMax = Math.max(clientMetrics[m.client_id].gbpCallsMax, m.gbp_calls || 0);
      clientMetrics[m.client_id].adsConversions += m.google_ads_conversions || 0;
      clientMetrics[m.client_id].adsConversionsMax = Math.max(clientMetrics[m.client_id].adsConversionsMax, m.google_ads_conversions || 0);
      clientMetrics[m.client_id].adsImpressions += m.ads_impressions || 0;
      clientMetrics[m.client_id].adsImpressionsMax = Math.max(clientMetrics[m.client_id].adsImpressionsMax, m.ads_impressions || 0);
      clientMetrics[m.client_id].adsClicks += m.ads_clicks || 0;
      clientMetrics[m.client_id].adsClicksMax = Math.max(clientMetrics[m.client_id].adsClicksMax, m.ads_clicks || 0);
      clientMetrics[m.client_id].recordCount += 1;
      clientMetrics[m.client_id].dates.push(m.date);
    });

    // Get client names
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true });

    const clientNameMap = {};
    if (!clientsError && clients) {
      clients.forEach(c => {
        clientNameMap[c.id] = c.name;
      });
    }

    // Count by client
    let gbp0Clients = 0;
    let gbpHasDataClients = 0;
    let ads0Clients = 0;
    let adsHasDataClients = 0;

    const clientAnalysis = [];
    for (const [clientId, metrics] of Object.entries(clientMetrics)) {
      const clientName = clientNameMap[clientId] || clientId;
      const gbpHasData = metrics.gbpCalls > 0;
      const adsHasData = metrics.adsConversions > 0 || metrics.adsImpressions > 0;

      if (gbpHasData) gbpHasDataClients++;
      else gbp0Clients++;

      if (adsHasData) adsHasDataClients++;
      else ads0Clients++;

      clientAnalysis.push({
        clientId,
        clientName,
        gbpCalls: metrics.gbpCalls,
        gbpCallsMax: metrics.gbpCallsMax,
        adsConversions: metrics.adsConversions,
        adsConversionsMax: metrics.adsConversionsMax,
        adsImpressions: metrics.adsImpressions,
        adsImpressionsMax: metrics.adsImpressionsMax,
        adsClicks: metrics.adsClicks,
        adsClicksMax: metrics.adsClicksMax,
        recordCount: metrics.recordCount,
        hasGBP: gbpHasData,
        hasAds: adsHasData,
        dateRange: {
          earliest: clientMetrics[clientId].dates.length > 0 ?
            new Date(clientMetrics[clientId].dates.sort()[0]).toISOString().split('T')[0] : 'N/A',
          latest: clientMetrics[clientId].dates.length > 0 ?
            new Date(clientMetrics[clientId].dates.sort().reverse()[0]).toISOString().split('T')[0] : 'N/A'
        }
      });
    }

    console.log(`\n👥 Total Unique Clients: ${Object.keys(clientMetrics).length}`);
    console.log(`\n📞 GBP Calls Distribution:`);
    console.log(`   Clients with 0 GBP calls (all zeros): ${gbp0Clients}`);
    console.log(`   Clients with >0 GBP calls (has data): ${gbpHasDataClients}`);
    console.log(`   Percentage with GBP data: ${(gbpHasDataClients / Object.keys(clientMetrics).length * 100).toFixed(2)}%`);

    console.log(`\n🎯 Google Ads Conversions Distribution:`);
    console.log(`   Clients with 0 Ads conversions: ${ads0Clients}`);
    console.log(`   Clients with >0 Ads conversions: ${adsHasDataClients}`);
    console.log(`   Percentage with Ads data: ${(adsHasDataClients / Object.keys(clientMetrics).length * 100).toFixed(2)}%`);

    // 6. Summary statistics
    console.log('\n' + '=' .repeat(80));
    console.log('5️⃣  SUMMARY STATISTICS');
    console.log('=' .repeat(80));

    const totalGBPCalls = Object.values(clientMetrics).reduce((sum, m) => sum + m.gbpCalls, 0);
    const totalAdsConversions = Object.values(clientMetrics).reduce((sum, m) => sum + m.adsConversions, 0);
    const totalAdsImpressions = Object.values(clientMetrics).reduce((sum, m) => sum + m.adsImpressions, 0);
    const totalAdsClicks = Object.values(clientMetrics).reduce((sum, m) => sum + m.adsClicks, 0);

    console.log(`\n📊 Total Aggregated Metrics (across all clients):`);
    console.log(`   Total GBP Calls: ${totalGBPCalls}`);
    console.log(`   Total Ads Conversions: ${totalAdsConversions}`);
    console.log(`   Total Ads Impressions: ${totalAdsImpressions}`);
    console.log(`   Total Ads Clicks: ${totalAdsClicks}`);

    console.log(`\n📈 Percentage of Records with Non-Zero Values:`);
    const gbpNonZeroPercent = (gbpNonZeroRecords.length / allMetrics.length * 100).toFixed(2);
    const adsConvPercent = (adsConvNonZero.length / allMetrics.length * 100).toFixed(2);
    const adsImpPercent = (adsImpNonZero.length / allMetrics.length * 100).toFixed(2);
    const adsClicksPercent = (adsClicksNonZero.length / allMetrics.length * 100).toFixed(2);

    console.log(`   GBP Calls: ${gbpNonZeroPercent}% (${gbpNonZeroRecords.length}/${allMetrics.length})`);
    console.log(`   Ads Conversions: ${adsConvPercent}% (${adsConvNonZero.length}/${allMetrics.length})`);
    console.log(`   Ads Impressions: ${adsImpPercent}% (${adsImpNonZero.length}/${allMetrics.length})`);
    console.log(`   Ads Clicks: ${adsClicksPercent}% (${adsClicksNonZero.length}/${allMetrics.length})`);

    // 7. Client Details Table
    console.log('\n' + '=' .repeat(80));
    console.log('6️⃣  CLIENT DETAILS TABLE');
    console.log('=' .repeat(80));

    // Sort by GBP + Ads data presence
    clientAnalysis.sort((a, b) => {
      const aHasData = (a.gbpCalls > 0 ? 1 : 0) + (a.adsConversions > 0 ? 1 : 0);
      const bHasData = (b.gbpCalls > 0 ? 1 : 0) + (b.adsConversions > 0 ? 1 : 0);
      return bHasData - aHasData;
    });

    console.log(`\n${'Client Name'.padEnd(35)} ${'GBP'.padEnd(8)} ${'Ads Conv'.padEnd(10)} ${'Date Range'.padEnd(21)} ${'Records'.padEnd(8)}`);
    console.log('-'.repeat(82));

    clientAnalysis.forEach(ca => {
      const gbpStr = ca.hasGBP ? `${ca.gbpCalls}` : '0';
      const adsStr = ca.hasAds ? `${ca.adsConversions}` : '0';
      const dateRange = `${ca.dateRange.earliest} to ${ca.dateRange.latest}`;
      console.log(
        `${ca.clientName.substring(0, 34).padEnd(35)} ${gbpStr.padEnd(8)} ${adsStr.padEnd(10)} ${dateRange.padEnd(21)} ${ca.recordCount.toString().padEnd(8)}`
      );
    });

    // 8. Clients with no data
    console.log('\n' + '=' .repeat(80));
    console.log('7️⃣  DATA AVAILABILITY SUMMARY');
    console.log('=' .repeat(80));

    const clientsWithBoth = clientAnalysis.filter(ca => ca.hasGBP && ca.hasAds).length;
    const clientsWithGBPOnly = clientAnalysis.filter(ca => ca.hasGBP && !ca.hasAds).length;
    const clientsWithAdsOnly = clientAnalysis.filter(ca => !ca.hasGBP && ca.hasAds).length;
    const clientsWithNeither = clientAnalysis.filter(ca => !ca.hasGBP && !ca.hasAds).length;

    console.log(`\n✅ Clients with Both GBP & Ads data: ${clientsWithBoth}`);
    console.log(`📞 Clients with GBP data only: ${clientsWithGBPOnly}`);
    console.log(`🎯 Clients with Ads data only: ${clientsWithAdsOnly}`);
    console.log(`❌ Clients with Neither: ${clientsWithNeither}`);

    if (clientsWithGBPOnly > 0) {
      console.log(`\n📞 Clients with GBP data only:`);
      clientAnalysis.filter(ca => ca.hasGBP && !ca.hasAds).forEach(ca => {
        console.log(`   - ${ca.clientName}: ${ca.gbpCalls} GBP calls`);
      });
    }

    if (clientsWithNeither > 0) {
      console.log(`\n❌ Clients with NO data (${clientsWithNeither}):`);
      clientAnalysis.filter(ca => !ca.hasGBP && !ca.hasAds).slice(0, 10).forEach(ca => {
        console.log(`   - ${ca.clientName}`);
      });
      if (clientsWithNeither > 10) {
        console.log(`   ... and ${clientsWithNeither - 10} more`);
      }
    }

    // 9. Recommendations
    console.log('\n' + '=' .repeat(80));
    console.log('8️⃣  RECOMMENDATIONS & INSIGHTS');
    console.log('=' .repeat(80));

    console.log(`\n🔴 CRITICAL ISSUES:`);
    if (gbpHasDataClients === 0) {
      console.log(`   - GBP CALLS: NO DATA AVAILABLE - All ${gbp0Clients} clients have 0 GBP calls`);
      console.log(`     ACTION: Verify GBP API integration is working or check if data is being collected`);
    } else if (gbpHasDataClients < Object.keys(clientMetrics).length / 4) {
      console.log(`   - GBP CALLS: LIMITED DATA - Only ${gbpHasDataClients}/${Object.keys(clientMetrics).length} clients have data`);
      console.log(`     ACTION: Check which clients have GBP configured and why others have no data`);
    }

    console.log(`\n⚠️  DATA QUALITY ISSUES:`);
    if (clientsWithNeither > Object.keys(clientMetrics).length * 0.2) {
      console.log(`   - ${clientsWithNeither} clients (${(clientsWithNeither / Object.keys(clientMetrics).length * 100).toFixed(1)}%) have NO metrics data`);
      console.log(`     ACTION: Investigate these clients for configuration or collection issues`);
    }

    if (allMetrics.length > 0) {
      const totalRecords = allMetrics.length;
      const avgPerClient = (totalRecords / Object.keys(clientMetrics).length).toFixed(1);
      console.log(`   - Average records per client: ${avgPerClient}`);
    }

    console.log(`\n✅ DATA STRENGTHS:`);
    console.log(`   - Google Ads data is comprehensive (${adsHasDataClients} clients with data)`);
    console.log(`   - ${adsConvPercent}% of records have Ads conversion data`);
    console.log(`   - Total ${allMetrics.length} records across ${Object.keys(clientMetrics).length} clients`);

    console.log(`\n💡 NEXT STEPS:`);
    console.log(`   1. Investigate GBP data collection pipeline`);
    console.log(`   2. Audit clients with zero data across both metrics`);
    console.log(`   3. Verify date ranges align with expected campaign periods`);
    console.log(`   4. Check API integrations for GBP if data should exist`);

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Analysis Complete');
    console.log('=' .repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

analyzeGBPAndGoogleAdsData();
