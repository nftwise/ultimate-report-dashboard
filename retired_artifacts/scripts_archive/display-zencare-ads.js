const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function displayZenCareAds() {
  try {
    const zenCareId = '0459d9d5-f4c6-444e-8f66-2c9f225deeb6';
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30); // 30 days
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    💰 ZENCARE - GOOGLE ADS DASHBOARD                           ║');
    console.log('║                        (Last 30 Days - Direct from Ads)                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
    console.log(`\n📅 Date Range: ${dateFromISO} → ${dateToISO}\n`);

    // 1. Campaign Metrics (Top section)
    const { data: campaignData } = await supabase
      .from('ads_campaign_metrics')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO);

    const totalSpend = (campaignData || []).reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalImpressions = (campaignData || []).reduce((sum, r) => sum + (r.impressions || 0), 0);
    const totalClicks = (campaignData || []).reduce((sum, r) => sum + (r.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;

    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 💸 TOTAL SPEND & PERFORMANCE                                                   │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│  Total Spend          │ $${totalSpend.toFixed(2).padStart(10)}                                      │`);
    console.log(`│  Impressions          │ ${totalImpressions.toString().padStart(10)}                                      │`);
    console.log(`│  Clicks               │ ${totalClicks.toString().padStart(10)}                                      │`);
    console.log(`│  CTR                  │ ${ctr.padStart(10)}%                                     │`);
    console.log(`│  CPC                  │ $${cpc.padStart(10)}                                      │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────┘\n');

    // 2. Conversions from campaign_conversion_actions
    const { data: conversionData } = await supabase
      .from('campaign_conversion_actions')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO);

    const convMap = new Map();
    (conversionData || []).forEach(r => {
      const key = r.conversion_action_name;
      if (!convMap.has(key)) {
        convMap.set(key, 0);
      }
      convMap.set(key, convMap.get(key) + r.conversions);
    });

    const totalConversions = (conversionData || []).reduce((sum, r) => sum + (r.conversions || 0), 0);
    const cpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : 0;

    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 📞 CONVERSIONS BREAKDOWN                                                       │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│  Total Conversions    │ ${totalConversions.toString().padStart(10)}                                      │`);
    console.log(`│  Cost Per Acquisition │ $${cpa.padStart(10)}                                      │`);
    console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
    convMap.forEach((count, name) => {
      console.log(`│  ${name.padEnd(26)} │ ${count.toString().padStart(10)}                                      │`);
    });
    console.log('└─────────────────────────────────────────────────────────────────────────────────┘\n');

    // 3. Top Search Terms
    const { data: searchTermData } = await supabase
      .from('campaign_search_terms')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('clicks', { ascending: false })
      .limit(10);

    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 🔍 TOP 10 SEARCH TERMS                                                         │');
    console.log('├──────────────────────────┬───────┬──────┬────────┬─────────────────────────────┤');
    console.log('│ Search Term              │ Impr  │Click │  Cost  │ CTR                         │');
    console.log('├──────────────────────────┼───────┼──────┼────────┼─────────────────────────────┤');
    (searchTermData || []).forEach(r => {
      const termDisplay = r.search_term.substring(0, 24).padEnd(24);
      const impressions = r.impressions.toString().padStart(5);
      const clicks = r.clicks.toString().padStart(4);
      const cost = `$${r.cost.toFixed(2)}`.padStart(6);
      const clickCtr = r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(1) : '0.0';
      const ctr = `${clickCtr}%`.padEnd(23);
      console.log(`│ ${termDisplay} │ ${impressions} │ ${clicks} │ ${cost} │ ${ctr} │`);
    });
    console.log('└──────────────────────────┴───────┴──────┴────────┴─────────────────────────────┘\n');

    // 4. Ad Group Performance
    const { data: adGroupData } = await supabase
      .from('ads_ad_group_metrics')
      .select('*')
      .eq('client_id', zenCareId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('cost', { ascending: false })
      .limit(10);

    const adGroupMap = new Map();
    (adGroupData || []).forEach(r => {
      const key = r.ad_group_name;
      if (!adGroupMap.has(key)) {
        adGroupMap.set(key, { impr: 0, clicks: 0, cost: 0, conv: 0 });
      }
      const entry = adGroupMap.get(key);
      entry.impr += r.impressions || 0;
      entry.clicks += r.clicks || 0;
      entry.cost += r.cost || 0;
      entry.conv += r.conversions || 0;
    });

    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 📊 TOP AD GROUPS BY SPEND                                                      │');
    console.log('├──────────────────────────┬──────┬───────┬────────┬──────┬────────────────────┤');
    console.log('│ Ad Group                 │Impr  │ Click │ Cost   │Conv  │ CPA                │');
    console.log('├──────────────────────────┼──────┼───────┼────────┼──────┼────────────────────┤');
    Array.from(adGroupMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .forEach(([name, metrics]) => {
        const nameDisplay = name.substring(0, 24).padEnd(24);
        const impr = metrics.impr.toString().padStart(4);
        const clicks = metrics.clicks.toString().padStart(5);
        const cost = `$${metrics.cost.toFixed(2)}`.padStart(6);
        const conv = metrics.conv.toString().padStart(4);
        const cpa = metrics.conv > 0 ? `$${(metrics.cost / metrics.conv).toFixed(2)}` : '$0.00';
        const cpaDisplay = cpa.padEnd(16);
        console.log(`│ ${nameDisplay} │${impr}  │${clicks}  │ ${cost} │${conv}  │ ${cpaDisplay} │`);
      });
    console.log('└──────────────────────────┴──────┴───────┴────────┴──────┴────────────────────┘\n');

    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         ✅ Data Source: Google Ads API                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

displayZenCareAds();
