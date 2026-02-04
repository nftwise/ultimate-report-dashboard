const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/imac2017/Desktop/ultimate-report-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  try {
    // 1. Get North Alabama client
    const { data: clients, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, slug')
      .ilike('name', '%north alabama%')
      .limit(1);

    if (clientErr) throw clientErr;
    if (!clients || clients.length === 0) {
      console.log('No client found matching "north alabama"');
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', client);

    const clientId = client.id;

    // 2. Check ads_ad_group_metrics
    const { data: adGroups, error: adErr } = await supabase
      .from('ads_ad_group_metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(3);

    console.log('\n📊 ads_ad_group_metrics (real data):');
    if (adErr) console.log('Error:', adErr);
    else console.log(JSON.stringify(adGroups, null, 2));

    // 3. Check campaign_search_terms
    const { data: searchTerms, error: stErr } = await supabase
      .from('campaign_search_terms')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(3);

    console.log('\n🔍 campaign_search_terms (real data):');
    if (stErr) console.log('Error:', stErr);
    else console.log(JSON.stringify(searchTerms, null, 2));

    // 4. Check google_ads_call_metrics
    const { data: callMetrics, error: cmErr } = await supabase
      .from('google_ads_call_metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(3);

    console.log('\n📞 google_ads_call_metrics (real data):');
    if (cmErr) console.log('Error:', cmErr);
    else console.log(JSON.stringify(callMetrics, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkData();
