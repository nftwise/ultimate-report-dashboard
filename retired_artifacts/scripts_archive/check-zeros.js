const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkZeros() {
  try {
    console.log('🔍 ANALYZING ROWS WITH ZEROS');
    console.log('='.repeat(80));

    // 1. client_metrics_summary - check distribution
    console.log('\n1️⃣ client_metrics_summary - Row distribution:');
    const { data: cms } = await supabase
      .from('client_metrics_summary')
      .select('*');

    if (cms) {
      const totalRows = cms.length;
      const rowsWithData = cms.filter(r =>
        (r.ad_spend > 0) || (r.form_fills > 0) || (r.total_leads > 0) || (r.ads_phone_calls > 0)
      ).length;
      const rowsAllZeros = totalRows - rowsWithData;

      console.log(`   Total rows: ${totalRows}`);
      console.log(`   Rows with data: ${rowsWithData}`);
      console.log(`   Rows with all zeros: ${rowsAllZeros}`);
      console.log(`   Data coverage: ${((rowsWithData / totalRows) * 100).toFixed(1)}%`);

      // Distribution by client
      const clientMap = new Map();
      cms.forEach(r => {
        if (!clientMap.has(r.client_id)) {
          clientMap.set(r.client_id, { total: 0, withData: 0 });
        }
        const entry = clientMap.get(r.client_id);
        entry.total++;
        if ((r.ad_spend > 0) || (r.form_fills > 0) || (r.total_leads > 0) || (r.ads_phone_calls > 0)) {
          entry.withData++;
        }
      });

      console.log(`\n   By client:`);
      Array.from(clientMap.entries()).slice(0, 5).forEach(([clientId, stats]) => {
        console.log(`     ${clientId}: ${stats.withData}/${stats.total} rows with data`);
      });
    }

    // 2. ads_ad_group_metrics - check zeros
    console.log('\n2️⃣ ads_ad_group_metrics - Row distribution:');
    const { data: aam } = await supabase
      .from('ads_ad_group_metrics')
      .select('*');

    if (aam) {
      const totalRows = aam.length;
      const rowsWithClicks = aam.filter(r => r.clicks > 0).length;
      const rowsZeroCost = aam.filter(r => r.cost === 0 || r.cost === null).length;

      console.log(`   Total rows: ${totalRows}`);
      console.log(`   Rows with clicks > 0: ${rowsWithClicks}`);
      console.log(`   Rows with cost = 0: ${rowsZeroCost}`);
      console.log(`   Data coverage: ${((rowsWithClicks / totalRows) * 100).toFixed(1)}%`);
    }

    // 3. campaign_search_terms - check zeros
    console.log('\n3️⃣ campaign_search_terms - Row distribution:');
    const { data: cst } = await supabase
      .from('campaign_search_terms')
      .select('*');

    if (cst) {
      const totalRows = cst.length;
      const rowsWithClicks = cst.filter(r => r.clicks > 0).length;
      const rowsZeroClicks = cst.filter(r => r.clicks === 0).length;

      console.log(`   Total rows: ${totalRows}`);
      console.log(`   Rows with clicks > 0: ${rowsWithClicks}`);
      console.log(`   Rows with clicks = 0: ${rowsZeroClicks}`);
      console.log(`   Data coverage: ${((rowsWithClicks / totalRows) * 100).toFixed(1)}%`);
    }

    // 4. Check Zen Care specifically
    console.log('\n4️⃣ ZENCARE (0459d9d5-f4c6-444e-8f66-2c9f225deeb6) - Data breakdown:');
    const zenCareId = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6';

    const { data: zenCMS } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', zenCareId);

    if (zenCMS) {
      const rowsWithData = zenCMS.filter(r =>
        (r.ad_spend > 0) || (r.form_fills > 0) || (r.total_leads > 0) || (r.ads_phone_calls > 0)
      ).length;
      console.log(`   Total rows for Zen Care: ${zenCMS.length}`);
      console.log(`   Rows with actual data: ${rowsWithData}`);

      // Show last 10 rows
      console.log(`\n   Last 10 dates with data (reversed):`);
      zenCMS.reverse().slice(0, 10).forEach(r => {
        console.log(`     ${r.date}: spend=$${r.ad_spend}, leads=${r.total_leads}, forms=${r.form_fills}, calls=${r.ads_phone_calls}`);
      });
    }

    // 5. Check date range coverage
    console.log('\n5️⃣ Date range coverage in each table:');

    const { data: cmsDates } = await supabase
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    const { data: cmsDateMin } = await supabase
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    console.log(`   client_metrics_summary: ${cmsDateMin?.[0]?.date} to ${cmsDates?.[0]?.date}`);

    const { data: aamDates } = await supabase
      .from('ads_ad_group_metrics')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    const { data: aamDateMin } = await supabase
      .from('ads_ad_group_metrics')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    console.log(`   ads_ad_group_metrics: ${aamDateMin?.[0]?.date} to ${aamDates?.[0]?.date}`);

    const { data: cstDates } = await supabase
      .from('campaign_search_terms')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    const { data: cstDateMin } = await supabase
      .from('campaign_search_terms')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    console.log(`   campaign_search_terms: ${cstDateMin?.[0]?.date} to ${cstDates?.[0]?.date}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkZeros();
