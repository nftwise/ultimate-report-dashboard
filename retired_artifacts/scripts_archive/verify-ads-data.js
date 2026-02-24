const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyAdsData() {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              🔍 VERIFY GOOGLE ADS DATA - 100% BACKFILL CHECK                   ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    // 1. Check ads_campaign_metrics
    console.log('1️⃣ ads_campaign_metrics:');
    const { data: campaignMetrics, error: cmError } = await supabase
      .from('ads_campaign_metrics')
      .select('*');

    if (cmError) {
      console.log(`   ❌ Error: ${cmError.message}`);
    } else {
      console.log(`   ✅ Total rows: ${campaignMetrics?.length || 0}`);

      if (campaignMetrics && campaignMetrics.length > 0) {
        // Check if all required fields exist
        const sampleRow = campaignMetrics[0];
        const requiredFields = ['client_id', 'campaign_id', 'campaign_name', 'date', 'impressions', 'clicks', 'cost', 'conversions'];
        const hasAllFields = requiredFields.every(field => field in sampleRow);
        console.log(`   ✅ All required fields: ${hasAllFields ? 'YES' : 'NO'}`);

        // Check for null/undefined values
        const withData = campaignMetrics.filter(r =>
          r.impressions > 0 || r.clicks > 0 || r.cost > 0
        ).length;
        console.log(`   ✅ Rows with data: ${withData}/${campaignMetrics.length} (${((withData/campaignMetrics.length)*100).toFixed(1)}%)`);

        // Date range
        const dates = campaignMetrics.map(r => r.date).sort();
        console.log(`   📅 Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

        // Total metrics
        const totalImpr = campaignMetrics.reduce((s, r) => s + (r.impressions || 0), 0);
        const totalClicks = campaignMetrics.reduce((s, r) => s + (r.clicks || 0), 0);
        const totalCost = campaignMetrics.reduce((s, r) => s + (r.cost || 0), 0);
        console.log(`   📊 Total: Impr=${totalImpr}, Clicks=${totalClicks}, Cost=$${totalCost.toFixed(2)}`);
      }
    }

    // 2. Check ads_ad_group_metrics
    console.log('\n2️⃣ ads_ad_group_metrics:');
    const { data: adGroupMetrics, error: agmError } = await supabase
      .from('ads_ad_group_metrics')
      .select('*');

    if (agmError) {
      console.log(`   ❌ Error: ${agmError.message}`);
    } else {
      console.log(`   ✅ Total rows: ${adGroupMetrics?.length || 0}`);

      if (adGroupMetrics && adGroupMetrics.length > 0) {
        const sampleRow = adGroupMetrics[0];
        const requiredFields = ['client_id', 'campaign_id', 'ad_group_id', 'ad_group_name', 'date', 'impressions', 'clicks', 'cost', 'conversions'];
        const hasAllFields = requiredFields.every(field => field in sampleRow);
        console.log(`   ✅ All required fields: ${hasAllFields ? 'YES' : 'NO'}`);

        const withData = adGroupMetrics.filter(r =>
          r.impressions > 0 || r.clicks > 0 || r.cost > 0
        ).length;
        console.log(`   ✅ Rows with data: ${withData}/${adGroupMetrics.length} (${((withData/adGroupMetrics.length)*100).toFixed(1)}%)`);

        const dates = adGroupMetrics.map(r => r.date).sort();
        console.log(`   📅 Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

        const totalImpr = adGroupMetrics.reduce((s, r) => s + (r.impressions || 0), 0);
        const totalClicks = adGroupMetrics.reduce((s, r) => s + (r.clicks || 0), 0);
        const totalCost = adGroupMetrics.reduce((s, r) => s + (r.cost || 0), 0);
        console.log(`   📊 Total: Impr=${totalImpr}, Clicks=${totalClicks}, Cost=$${totalCost.toFixed(2)}`);
      }
    }

    // 3. Check campaign_search_terms
    console.log('\n3️⃣ campaign_search_terms:');
    const { data: searchTerms, error: stError } = await supabase
      .from('campaign_search_terms')
      .select('*');

    if (stError) {
      console.log(`   ❌ Error: ${stError.message}`);
    } else {
      console.log(`   ✅ Total rows: ${searchTerms?.length || 0}`);

      if (searchTerms && searchTerms.length > 0) {
        const sampleRow = searchTerms[0];
        const requiredFields = ['client_id', 'campaign_id', 'date', 'search_term', 'impressions', 'clicks', 'cost'];
        const hasAllFields = requiredFields.every(field => field in sampleRow);
        console.log(`   ✅ All required fields: ${hasAllFields ? 'YES' : 'NO'}`);

        const withClicks = searchTerms.filter(r => r.clicks > 0).length;
        console.log(`   ✅ Terms with clicks: ${withClicks}/${searchTerms.length} (${((withClicks/searchTerms.length)*100).toFixed(1)}%)`);

        const dates = searchTerms.map(r => r.date).sort();
        console.log(`   📅 Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

        const totalImpr = searchTerms.reduce((s, r) => s + (r.impressions || 0), 0);
        const totalClicks = searchTerms.reduce((s, r) => s + (r.clicks || 0), 0);
        const totalCost = searchTerms.reduce((s, r) => s + (r.cost || 0), 0);
        console.log(`   📊 Total: Impr=${totalImpr}, Clicks=${totalClicks}, Cost=$${totalCost.toFixed(2)}`);
      }
    }

    // 4. Check campaign_conversion_actions
    console.log('\n4️⃣ campaign_conversion_actions:');
    const { data: convActions, error: caError } = await supabase
      .from('campaign_conversion_actions')
      .select('*');

    if (caError) {
      console.log(`   ❌ Error: ${caError.message}`);
    } else {
      console.log(`   ✅ Total rows: ${convActions?.length || 0}`);

      if (convActions && convActions.length > 0) {
        const sampleRow = convActions[0];
        const requiredFields = ['client_id', 'campaign_id', 'date', 'conversion_action_name', 'conversion_action_type', 'conversions'];
        const hasAllFields = requiredFields.every(field => field in sampleRow);
        console.log(`   ✅ All required fields: ${hasAllFields ? 'YES' : 'NO'}`);

        const withConv = convActions.filter(r => r.conversions > 0).length;
        console.log(`   ✅ Rows with conversions: ${withConv}/${convActions.length} (${((withConv/convActions.length)*100).toFixed(1)}%)`);

        const dates = convActions.map(r => r.date).sort();
        console.log(`   📅 Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

        const totalConv = convActions.reduce((s, r) => s + (r.conversions || 0), 0);
        const totalValue = convActions.reduce((s, r) => s + (r.conversion_value || 0), 0);
        console.log(`   📊 Total: Conversions=${totalConv}, Value=$${totalValue.toFixed(2)}`);

        // Breakdown by type
        const typeMap = new Map();
        convActions.forEach(r => {
          const key = r.conversion_action_name;
          if (!typeMap.has(key)) {
            typeMap.set(key, 0);
          }
          typeMap.set(key, typeMap.get(key) + r.conversions);
        });
        console.log(`   📋 Conversion types:`);
        Array.from(typeMap.entries()).forEach(([type, count]) => {
          console.log(`      - ${type}: ${count}`);
        });
      }
    }

    // 5. Check for AI-generated tables
    console.log('\n5️⃣ AI-Generated Tables (should NOT use):');

    const { data: insights } = await supabase
      .from('ads_insights')
      .select('*');
    console.log(`   ⚠️ ads_insights: ${insights?.length || 0} rows (DO NOT USE)`);

    const { data: correlations } = await supabase
      .from('ads_correlation_patterns')
      .select('*');
    console.log(`   ⚠️ ads_correlation_patterns: ${correlations?.length || 0} rows (DO NOT USE)`);

    // 6. Empty tables check
    console.log('\n6️⃣ Empty Tables:');

    const { data: callMetrics } = await supabase
      .from('google_ads_call_metrics')
      .select('*');
    console.log(`   ⚠️ google_ads_call_metrics: ${callMetrics?.length || 0} rows (empty)`);

    const { data: adPerf } = await supabase
      .from('google_ads_ad_performance')
      .select('*');
    console.log(`   ⚠️ google_ads_ad_performance: ${adPerf?.length || 0} rows (empty)`);

    console.log('\n' + '╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         ✅ VERIFICATION COMPLETE                                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyAdsData();
