const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAdsData() {
  try {
    console.log('🔍 ZENCARE - GOOGLE ADS DATA ONLY (NO GA4)');
    console.log('='.repeat(80));

    const zenCareId = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6';
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90); // 90 days
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log(`Date range: ${dateFromISO} to ${dateToISO}`);
    console.log('='.repeat(80));

    // 1. ads_ad_group_metrics - DIRECT from Google Ads
    console.log('\n1️⃣ ads_ad_group_metrics (Direct from Google Ads API):');
    const { data: adMetrics } = await supabase
      .from('ads_ad_group_metrics')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false });

    if (adMetrics && adMetrics.length > 0) {
      console.log(`   Total rows: ${adMetrics.length}`);

      // Aggregate metrics
      const totalImpressions = adMetrics.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const totalClicks = adMetrics.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalCost = adMetrics.reduce((sum, r) => sum + (r.cost || 0), 0);
      const totalConversions = adMetrics.reduce((sum, r) => sum + (r.conversions || 0), 0);

      console.log(`   Total Impressions: ${totalImpressions}`);
      console.log(`   Total Clicks: ${totalClicks}`);
      console.log(`   Total Cost: $${totalCost.toFixed(2)}`);
      console.log(`   Total Conversions: ${totalConversions}`);
      console.log(`   CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
      console.log(`   CPC: $${totalClicks > 0 ? (totalCost / totalClicks).toFixed(2) : 0}`);
      console.log(`   CPA: $${totalConversions > 0 ? (totalCost / totalConversions).toFixed(2) : 0}`);

      console.log(`\n   Sample rows:`);
      adMetrics.slice(0, 5).forEach(r => {
        console.log(`     ${r.date}: ${r.ad_group_name} - Impr=${r.impressions}, Clicks=${r.clicks}, Cost=$${r.cost.toFixed(2)}, Conv=${r.conversions}`);
      });
    } else {
      console.log('   ❌ No data');
    }

    // 2. campaign_search_terms - DIRECT from Google Ads
    console.log('\n2️⃣ campaign_search_terms (Direct from Google Ads API):');
    const { data: searchTerms } = await supabase
      .from('campaign_search_terms')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .gt('clicks', 0)
      .order('clicks', { ascending: false });

    if (searchTerms && searchTerms.length > 0) {
      console.log(`   Total search terms with clicks: ${searchTerms.length}`);

      const totalImpressions = searchTerms.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const totalClicks = searchTerms.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalCost = searchTerms.reduce((sum, r) => sum + (r.cost || 0), 0);

      console.log(`   Total Impressions: ${totalImpressions}`);
      console.log(`   Total Clicks: ${totalClicks}`);
      console.log(`   Total Cost: $${totalCost.toFixed(2)}`);

      console.log(`\n   Top 5 search terms:`);
      searchTerms.slice(0, 5).forEach((r, i) => {
        console.log(`     ${i + 1}. "${r.search_term}" - Clicks=${r.clicks}, Impr=${r.impressions}, Cost=$${r.cost.toFixed(2)}`);
      });
    } else {
      console.log('   ❌ No search terms with clicks');
    }

    // 3. campaign_conversion_actions - DIRECT from Google Ads
    console.log('\n3️⃣ campaign_conversion_actions (Direct from Google Ads API):');
    const { data: convActions } = await supabase
      .from('campaign_conversion_actions')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false });

    if (convActions && convActions.length > 0) {
      console.log(`   Total conversion action rows: ${convActions.length}`);

      const totalConversions = convActions.reduce((sum, r) => sum + (r.conversions || 0), 0);
      const totalValue = convActions.reduce((sum, r) => sum + (r.conversion_value || 0), 0);

      console.log(`   Total Conversions: ${totalConversions}`);
      console.log(`   Total Conversion Value: $${totalValue.toFixed(2)}`);

      // Group by conversion type
      const typeMap = new Map();
      convActions.forEach(r => {
        const key = r.conversion_action_name || r.conversion_action_type;
        if (!typeMap.has(key)) {
          typeMap.set(key, 0);
        }
        typeMap.set(key, typeMap.get(key) + r.conversions);
      });

      console.log(`\n   Conversion types:`);
      Array.from(typeMap.entries()).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}`);
      });

      console.log(`\n   Sample rows:`);
      convActions.slice(0, 5).forEach(r => {
        console.log(`     ${r.date}: ${r.conversion_action_name} - ${r.conversions} conversions`);
      });
    } else {
      console.log('   ❌ No conversion actions');
    }

    // 4. ads_campaign_metrics - DIRECT from Google Ads
    console.log('\n4️⃣ ads_campaign_metrics (Direct from Google Ads API):');
    const { data: campaignMetrics } = await supabase
      .from('ads_campaign_metrics')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false });

    if (campaignMetrics && campaignMetrics.length > 0) {
      console.log(`   Total rows: ${campaignMetrics.length}`);

      const totalImpressions = campaignMetrics.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const totalClicks = campaignMetrics.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalCost = campaignMetrics.reduce((sum, r) => sum + (r.cost || 0), 0);

      console.log(`   Total Impressions: ${totalImpressions}`);
      console.log(`   Total Clicks: ${totalClicks}`);
      console.log(`   Total Cost: $${totalCost.toFixed(2)}`);

      console.log(`\n   Sample rows:`);
      campaignMetrics.slice(0, 5).forEach(r => {
        console.log(`     ${r.date}: ${r.campaign_name} - Impr=${r.impressions}, Clicks=${r.clicks}, Cost=$${r.cost.toFixed(2)}`);
      });
    } else {
      console.log('   ❌ No campaign metrics');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ SUMMARY - Google Ads data available:');
    console.log(`   ✓ ads_ad_group_metrics: ${adMetrics?.length || 0} rows`);
    console.log(`   ✓ campaign_search_terms: ${searchTerms?.length || 0} rows with clicks`);
    console.log(`   ✓ campaign_conversion_actions: ${convActions?.length || 0} rows`);
    console.log(`   ✓ ads_campaign_metrics: ${campaignMetrics?.length || 0} rows`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAdsData();
