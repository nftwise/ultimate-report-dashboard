const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debug() {
  try {
    console.log('🔍 Checking client_metrics_summary for form-related fields:\n');

    // Get all columns
    const { data: sample } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .limit(1);

    if (sample && sample.length > 0) {
      const allFields = Object.keys(sample[0]);
      const formRelatedFields = allFields.filter(f =>
        f.includes('form') || f.includes('submission') || f.includes('conversion') || f.includes('lead')
      );

      console.log('All form/conversion/lead related fields:');
      formRelatedFields.forEach(f => {
        console.log(`  - ${f}`);
      });

      console.log('\n📊 Sample data for these fields:');
      const row = sample[0];
      formRelatedFields.forEach(f => {
        console.log(`  ${f}: ${row[f]}`);
      });

      // Check what other tables might have form success data
      console.log('\n\n🔎 Checking other tables for form conversions:');

      // Check ga4_conversions
      const { data: ga4Conv } = await supabase
        .from('ga4_conversions')
        .select('*')
        .limit(1);

      if (ga4Conv && ga4Conv.length > 0) {
        console.log('\nga4_conversions fields:');
        Object.keys(ga4Conv[0]).forEach(f => {
          console.log(`  - ${f}`);
        });
      } else {
        console.log('\nga4_conversions: Empty');
      }

      // Check campaign_conversion_actions
      const { data: convActions } = await supabase
        .from('campaign_conversion_actions')
        .select('*')
        .limit(1);

      if (convActions && convActions.length > 0) {
        console.log('\ncampaign_conversion_actions fields:');
        Object.keys(convActions[0]).forEach(f => {
          console.log(`  - ${f}`);
        });
      } else {
        console.log('\ncampaign_conversion_actions: Empty');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debug();
