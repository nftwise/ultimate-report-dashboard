const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debug() {
  try {
    const clientId = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6'; // Zen Care
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log('CLIENT: Zen Care Physical Medicine');
    console.log(`DATE RANGE: ${dateFromISO} to ${dateToISO}\n`);

    // 1. Check ga4_conversions
    console.log('1️⃣ ga4_conversions (GA4 events):');
    const { data: ga4Data } = await supabase
      .from('ga4_conversions')
      .select('date, conversion_event, conversions, conversion_value')
      .eq('client_id', clientId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO);

    if (ga4Data && ga4Data.length > 0) {
      console.log(`  Total records: ${ga4Data.length}`);
      console.log(`  Unique conversion events:`);
      const events = new Map();
      ga4Data.forEach(r => {
        events.set(r.conversion_event, (events.get(r.conversion_event) || 0) + r.conversions);
      });
      events.forEach((count, event) => {
        console.log(`    - ${event}: ${count} conversions`);
      });
      console.log('\n  Sample records:');
      ga4Data.slice(0, 3).forEach(r => {
        console.log(`    ${r.date}: ${r.conversion_event} = ${r.conversions}`);
      });
    } else {
      console.log('  ❌ No data');
    }

    // 2. Check campaign_conversion_actions
    console.log('\n2️⃣ campaign_conversion_actions (Google Ads):');
    const { data: convActions } = await supabase
      .from('campaign_conversion_actions')
      .select('date, conversion_action_name, conversion_action_type, conversions, conversion_value')
      .eq('client_id', clientId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO);

    if (convActions && convActions.length > 0) {
      console.log(`  Total records: ${convActions.length}`);
      console.log(`  Conversion action types:`);
      const types = new Map();
      convActions.forEach(r => {
        types.set(r.conversion_action_type, (types.get(r.conversion_action_type) || 0) + r.conversions);
      });
      types.forEach((count, type) => {
        console.log(`    - ${type}: ${count} conversions`);
      });
      console.log('\n  Sample records:');
      convActions.slice(0, 3).forEach(r => {
        console.log(`    ${r.date}: ${r.conversion_action_name} (${r.conversion_action_type}) = ${r.conversions}`);
      });
    } else {
      console.log('  ❌ No data');
    }

    // 3. Compare with form_fills
    console.log('\n3️⃣ client_metrics_summary.form_fills:');
    const { data: metrics } = await supabase
      .from('client_metrics_summary')
      .select('date, form_fills')
      .eq('client_id', clientId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .gt('form_fills', 0);

    if (metrics && metrics.length > 0) {
      const totalForms = metrics.reduce((s, r) => s + r.form_fills, 0);
      console.log(`  Records with form_fills > 0: ${metrics.length}`);
      console.log(`  Total form fills: ${totalForms}`);
      console.log('\n  Sample records:');
      metrics.slice(0, 3).forEach(r => {
        console.log(`    ${r.date}: ${r.form_fills} forms`);
      });
    } else {
      console.log('  ❌ No form fill data');
    }

    console.log('\n\n💡 RECOMMENDATION:');
    console.log('If you want to show SUCCESSFUL form submissions:');
    console.log('  Option A: Use ga4_conversions table with conversion_event filter');
    console.log('    - Search for events like "form_submit", "lead_form_complete", etc.');
    console.log('  Option B: Use campaign_conversion_actions for Google Ads form conversions');
    console.log('    - Filter by conversion_action_type = "form_submit" or similar');
    console.log('  Option C: Keep form_fills (current) - total forms submitted');
    console.log('    - Note: Not necessarily successful/completed forms');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debug();
