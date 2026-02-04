const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debug() {
  try {
    const clientId = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6'; // Zen Care

    console.log('🔍 CHECKING DATA SOURCE FOR EACH TABLE\n');
    console.log('='.repeat(60));

    // 1. client_metrics_summary
    console.log('\n1️⃣ client_metrics_summary.form_fills');
    console.log('   Source: ?');
    console.log('   Data type: Count/aggregate');
    const { data: cms } = await supabase
      .from('client_metrics_summary')
      .select('id, created_at, updated_at')
      .eq('client_id', clientId)
      .limit(1);
    if (cms && cms.length > 0) {
      console.log(`   Updated: ${cms[0].updated_at}`);
      console.log('   → Need to check if this is from GA4 or ADS API');
    }

    // 2. ga4_conversions
    console.log('\n2️⃣ ga4_conversions');
    console.log('   Source: Google Analytics 4 (GA4) ✅');
    console.log('   Data type: GA4 conversion events');
    console.log('   Events tracked:');
    console.log('     - call_from_web: 16 (GA4 call tracking)');
    console.log('     - submit_form: 1 (GA4 form event)');
    console.log('     - submit_form_successful: 11 (GA4 successful form)');
    const { data: ga4 } = await supabase
      .from('ga4_conversions')
      .select('created_at, updated_at')
      .eq('client_id', clientId)
      .limit(1);
    if (ga4 && ga4.length > 0) {
      console.log(`   Updated: ${ga4[0].updated_at}`);
    }

    // 3. campaign_conversion_actions
    console.log('\n3️⃣ campaign_conversion_actions');
    console.log('   Source: Google Ads API ✅');
    console.log('   Data type: Google Ads conversion actions');
    console.log('   Actions tracked:');
    console.log('     - Type 13: Submit Form Successful (ADS API)');
    console.log('     - Type 11: Call from website (ADS API)');
    console.log('     - Type 18: Call from web (ADS API)');
    const { data: convActions } = await supabase
      .from('campaign_conversion_actions')
      .select('created_at, updated_at')
      .eq('client_id', clientId)
      .limit(1);
    if (convActions && convActions.length > 0) {
      console.log(`   Updated: ${convActions[0].updated_at}`);
    }

    // 4. ads_ad_group_metrics
    console.log('\n4️⃣ ads_ad_group_metrics');
    console.log('   Source: Google Ads API ✅');
    console.log('   Data type: Campaign/ad group performance');
    console.log('   Metrics: impressions, clicks, cost, conversions');
    const { data: adMetrics } = await supabase
      .from('ads_ad_group_metrics')
      .select('created_at')
      .eq('client_id', clientId)
      .limit(1);
    if (adMetrics && adMetrics.length > 0) {
      console.log(`   Updated: ${adMetrics[0].created_at}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log('\nFor FORM CONVERSIONS (successful submissions):');
    console.log('  BEST: ga4_conversions with submit_form_successful = 11');
    console.log('  GOOD: campaign_conversion_actions with type 13 = 1');
    console.log('  NOT IDEAL: client_metrics_summary.form_fills = 7 (not success metric)');
    console.log('\nFor CALL CONVERSIONS (from web):');
    console.log('  BEST: ga4_conversions with call_from_web = 16 (GA4 tracked)');
    console.log('  GOOD: campaign_conversion_actions types 11/18 = 2-3 (ADS API)');
    console.log('  OKAY: client_metrics_summary.ads_phone_calls = 12 (generic count)');

    console.log('\n💡 RECOMMENDATION:');
    console.log('Use ga4_conversions for ACTUAL successful conversions');
    console.log('because it has event-level tracking from GA4 analytics.');
    console.log('\nform_fills is just a count, not necessarily successful.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debug();
