const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugPhoneCallsIssue() {
  console.log('\n' + '='.repeat(80));
  console.log('DEBUG: WHY PHONE CALLS = 0 WHILE WEB CLICKS & DIRECTIONS SHOW DATA');
  console.log('='.repeat(80) + '\n');

  // Use a client with known good GBP data
  const clientId = 'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6'; // DeCarlo

  // Try August 2025
  const dateFromISO = '2025-08-01';
  const dateToISO = '2025-08-31';

  console.log(`Testing: August 2025 (${dateFromISO} to ${dateToISO})\n`);

  // Get raw GBP data
  const { data: gbpRaw } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .limit(5);

  console.log('1️⃣ RAW GBP DATA (first 5 records):');
  if (gbpRaw && gbpRaw.length > 0) {
    gbpRaw.forEach((record, i) => {
      console.log(`\nRecord ${i + 1}:`);
      console.log(`  date: ${record.date}`);
      console.log(`  phone_calls: ${record.phone_calls} (type: ${typeof record.phone_calls})`);
      console.log(`  views: ${record.views}`);
      console.log(`  website_clicks: ${record.website_clicks}`);
      console.log(`  direction_requests: ${record.direction_requests}`);
      console.log(`  actions: ${record.actions}`);
    });
  } else {
    console.log('  No GBP records found for August');
  }

  // Check what columns are actually in the table
  const { data: allColumns } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);

  console.log('\n2️⃣ ALL AVAILABLE COLUMNS IN TABLE:');
  if (allColumns && allColumns.length > 0) {
    const record = allColumns[0];
    Object.keys(record).forEach(key => {
      console.log(`  ${key}: ${record[key]}`);
    });
  }

  // Check specifically for phone call related fields
  console.log('\n3️⃣ CHECKING PHONE CALL RELATED FIELDS:');
  const phoneRelatedFields = [
    'phone_calls',
    'calls',
    'phone_call',
    'gbp_calls',
    'gbp_phone_calls',
    'phone',
    'call'
  ];

  if (gbpRaw && gbpRaw.length > 0) {
    const sample = gbpRaw[0];
    console.log('Fields in sample record:');
    phoneRelatedFields.forEach(field => {
      if (field in sample) {
        console.log(`  ✅ ${field}: ${sample[field]}`);
      }
    });
  }

  // Check client_metrics_summary gbp_calls column
  console.log('\n4️⃣ CHECKING client_metrics_summary.gbp_calls:');
  const { data: clientMetrics } = await supabase
    .from('client_metrics_summary')
    .select('date, gbp_calls')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .limit(5);

  if (clientMetrics && clientMetrics.length > 0) {
    clientMetrics.forEach(m => {
      console.log(`  ${m.date}: gbp_calls = ${m.gbp_calls}`);
    });
  }

  // Check if there's ANY non-zero phone_calls data at all
  console.log('\n5️⃣ CHECKING FOR ANY NON-ZERO phone_calls DATA:');
  const { data: nonZeroCalls, count: nonZeroCount } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls', { count: 'exact' })
    .eq('client_id', clientId)
    .gt('phone_calls', 0);

  console.log(`  Total records with phone_calls > 0: ${nonZeroCount}`);
  if (nonZeroCalls && nonZeroCalls.length > 0) {
    console.log(`  Sample non-zero records:`);
    nonZeroCalls.slice(0, 5).forEach(r => {
      console.log(`    ${r.date}: ${r.phone_calls}`);
    });
  }

  // Check web_clicks for comparison
  console.log('\n6️⃣ CHECKING web_clicks FOR COMPARISON:');
  const { data: webClicks } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls, website_clicks')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO)
    .limit(5);

  if (webClicks && webClicks.length > 0) {
    console.log('  Comparing phone_calls vs website_clicks:');
    webClicks.forEach(w => {
      console.log(`    ${w.date}: phone_calls=${w.phone_calls}, website_clicks=${w.website_clicks}`);
    });
  }

  // Check the actual August data range
  console.log('\n7️⃣ TOTAL STATS FOR AUGUST 2025:');
  const { data: allAugust } = await supabase
    .from('gbp_location_daily_metrics')
    .select('phone_calls, website_clicks, direction_requests')
    .eq('client_id', clientId)
    .gte('date', dateFromISO)
    .lte('date', dateToISO);

  if (allAugust && allAugust.length > 0) {
    const phoneTotal = allAugust.reduce((s, d) => s + (d.phone_calls || 0), 0);
    const webTotal = allAugust.reduce((s, d) => s + (d.website_clicks || 0), 0);
    const dirTotal = allAugust.reduce((s, d) => s + (d.direction_requests || 0), 0);

    console.log(`  Records: ${allAugust.length}`);
    console.log(`  Phone Calls Total: ${phoneTotal}`);
    console.log(`  Web Clicks Total: ${webTotal}`);
    console.log(`  Directions Total: ${dirTotal}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

debugPhoneCallsIssue();
