const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findClientsWithSeoData() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║     🔍 FIND CLIENTS WITH SEO DATA (LAST 30 DAYS)              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get date range (last 30 days)
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Get all metrics in date range
    const { data: allMetrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('client_id, seo_impressions, seo_clicks, traffic_organic, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined')
      .gte('date', dateFromISO)
      .lte('date', dateToISO);

    if (metricsError) {
      console.log(`❌ Error: ${metricsError.message}`);
      return;
    }

    console.log(`✅ Found ${allMetrics?.length || 0} metric records\n`);

    // Aggregate by client
    const clientData = {};
    (allMetrics || []).forEach(row => {
      if (!clientData[row.client_id]) {
        clientData[row.client_id] = {
          seo_impressions: 0,
          seo_clicks: 0,
          traffic_organic: 0,
          branded_traffic: 0,
          non_branded_traffic: 0,
          keywords_improved: 0,
          keywords_declined: 0,
          records: 0
        };
      }
      clientData[row.client_id].seo_impressions += row.seo_impressions || 0;
      clientData[row.client_id].seo_clicks += row.seo_clicks || 0;
      clientData[row.client_id].traffic_organic += row.traffic_organic || 0;
      clientData[row.client_id].branded_traffic += row.branded_traffic || 0;
      clientData[row.client_id].non_branded_traffic += row.non_branded_traffic || 0;
      clientData[row.client_id].keywords_improved += row.keywords_improved || 0;
      clientData[row.client_id].keywords_declined += row.keywords_declined || 0;
      clientData[row.client_id].records++;
    });

    // Get client names
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug');

    const clientMap = {};
    (clients || []).forEach(c => {
      clientMap[c.id] = { name: c.name, slug: c.slug };
    });

    // Filter clients with SEO data and sort
    const clientsWithData = Object.entries(clientData)
      .map(([clientId, data]) => ({
        clientId,
        name: clientMap[clientId]?.name || 'Unknown',
        slug: clientMap[clientId]?.slug || 'unknown',
        ...data
      }))
      .filter(c => c.seo_impressions > 0 || c.seo_clicks > 0 || c.traffic_organic > 0 || c.branded_traffic > 0 || c.non_branded_traffic > 0)
      .sort((a, b) => (b.seo_impressions + b.seo_clicks) - (a.seo_impressions + a.seo_clicks));

    if (clientsWithData.length === 0) {
      console.log('❌ No clients found with SEO data in last 30 days');
      return;
    }

    console.log(`📊 Clients with SEO data: ${clientsWithData.length}\n`);
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ Client Name              │ Impressions │ Clicks │ Organic │ Score │');
    console.log('├─────────────────────────────────────────────────────────────────┤');

    clientsWithData.slice(0, 10).forEach((c, idx) => {
      const score = (c.seo_impressions * 0.1) + (c.seo_clicks * 0.5) + (c.traffic_organic * 0.2);
      console.log(
        `│ ${c.name.substring(0, 24).padEnd(24)} │ ${String(Math.floor(c.seo_impressions)).padStart(11)} │ ${String(Math.floor(c.seo_clicks)).padStart(6)} │ ${String(Math.floor(c.traffic_organic)).padStart(7)} │ ${score.toFixed(1).padStart(5)} │`
      );
    });

    console.log('└─────────────────────────────────────────────────────────────────┘\n');

    // Show top client details
    if (clientsWithData.length > 0) {
      const topClient = clientsWithData[0];
      console.log('🏆 TOP CLIENT WITH BEST SEO DATA:');
      console.log('─'.repeat(70));
      console.log(`Name:        ${topClient.name}`);
      console.log(`Slug:        ${topClient.slug}`);
      console.log(`Client ID:   ${topClient.clientId}`);
      console.log(`Records:     ${topClient.records}`);
      console.log(`Impressions: ${topClient.seo_impressions}`);
      console.log(`Clicks:      ${topClient.seo_clicks}`);
      console.log(`Organic Traffic: ${topClient.traffic_organic}`);
      console.log(`Branded Traffic: ${topClient.branded_traffic}`);
      console.log(`Non-Branded Traffic: ${topClient.non_branded_traffic}`);
      console.log(`Keywords Improved: ${topClient.keywords_improved}`);
      console.log(`Keywords Declined: ${topClient.keywords_declined}`);
      console.log('\n🔗 Test URL: /admin-dashboard/' + topClient.slug + '/seo');
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ANALYSIS COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findClientsWithSeoData();
