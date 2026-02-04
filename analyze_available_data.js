const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/imac2017/Desktop/ultimate-report-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeData() {
  try {
    // Get client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug')
      .ilike('name', '%north alabama%')
      .limit(1);

    if (!clients || !clients[0]) {
      console.log('Client not found');
      return;
    }

    const clientId = clients[0].id;
    console.log('📊 ANALYZING DATA FOR:', clients[0].name);
    console.log('================================\n');

    // 1. Check what columns exist in each table
    console.log('📋 TABLE SCHEMAS:\n');

    // ads_ad_group_metrics columns
    const { data: adMetrics } = await supabase
      .from('ads_ad_group_metrics')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (adMetrics && adMetrics[0]) {
      console.log('✅ ads_ad_group_metrics columns:', Object.keys(adMetrics[0]));
      console.log('   Sample:', adMetrics[0]);
    }

    // campaign_search_terms columns
    const { data: searchTerms } = await supabase
      .from('campaign_search_terms')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (searchTerms && searchTerms[0]) {
      console.log('\n✅ campaign_search_terms columns:', Object.keys(searchTerms[0]));
      console.log('   Sample:', searchTerms[0]);
    }

    // google_ads_call_metrics columns
    const { data: callMetrics } = await supabase
      .from('google_ads_call_metrics')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (callMetrics && callMetrics[0]) {
      console.log('\n✅ google_ads_call_metrics columns:', Object.keys(callMetrics[0]));
      console.log('   Sample:', callMetrics[0]);
    } else {
      console.log('\n⚠️  google_ads_call_metrics: No data for this client');
    }

    // client_metrics_summary for device data
    const { data: metrics } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (metrics && metrics[0]) {
      console.log('\n✅ client_metrics_summary columns:', Object.keys(metrics[0]));
      console.log('   Sample:', metrics[0]);
    }

    // 2. Check for device data
    console.log('\n\n📱 DEVICE DATA AVAILABILITY:\n');
    
    // Look for device-related columns
    const allKeys = metrics && metrics[0] ? Object.keys(metrics[0]) : [];
    const deviceRelated = allKeys.filter(k => k.toLowerCase().includes('device') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('desktop'));
    console.log('Device columns in client_metrics_summary:', deviceRelated.length > 0 ? deviceRelated : 'NONE');

    // 3. Aggregated stats
    console.log('\n\n📈 AGGREGATED STATS (Last 30 days):\n');

    const { data: aggAds } = await supabase
      .from('ads_ad_group_metrics')
      .select('cost, conversions, clicks, impressions')
      .eq('client_id', clientId)
      .gte('date', '2026-01-05')
      .lte('date', '2026-02-04');

    if (aggAds && aggAds.length > 0) {
      const totalSpend = aggAds.reduce((sum, row) => sum + (row.cost || 0), 0);
      const totalConversions = aggAds.reduce((sum, row) => sum + (row.conversions || 0), 0);
      const totalClicks = aggAds.reduce((sum, row) => sum + (row.clicks || 0), 0);
      const totalImpressions = aggAds.reduce((sum, row) => sum + (row.impressions || 0), 0);
      
      console.log('Total Ad Spend: $' + totalSpend.toFixed(2));
      console.log('Total Conversions: ' + totalConversions);
      console.log('Total Clicks: ' + totalClicks);
      console.log('Total Impressions: ' + totalImpressions);
      console.log('CPL: $' + (totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : 'N/A'));
      console.log('CTR: ' + (totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0') + '%');
    }

    // 4. Conversion breakdown
    console.log('\n\n🔍 SEARCH TERMS WITH CONVERSIONS:\n');
    
    const { data: termsWithConv } = await supabase
      .from('campaign_search_terms')
      .select('search_term, conversions, clicks, cost, impressions')
      .eq('client_id', clientId)
      .gt('conversions', 0)
      .order('conversions', { ascending: false })
      .limit(5);

    if (termsWithConv && termsWithConv.length > 0) {
      console.log('Top search terms by conversions:');
      termsWithConv.forEach((t, i) => {
        console.log(`  ${i+1}. "${t.search_term}" - ${t.conversions} conversions, $${(t.cost || 0).toFixed(2)}`);
      });
    } else {
      console.log('No search terms with conversions found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeData();
