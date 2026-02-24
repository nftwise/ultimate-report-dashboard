const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findSEODataDecJan() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║    🔍 FIND CLIENTS WITH SEO DATA (DEC 2025 - JAN 2026)         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const dateFromISO = '2025-12-01';
    const dateToISO = '2026-01-31';

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Get all metrics in this period
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

    // Filter and sort
    const clientsWithData = Object.entries(clientData)
      .map(([clientId, data]) => ({
        clientId,
        name: clientMap[clientId]?.name || 'Unknown',
        slug: clientMap[clientId]?.slug || 'unknown',
        ...data
      }))
      .filter(c => c.seo_impressions > 0 || c.seo_clicks > 0 || c.traffic_organic > 0)
      .sort((a, b) => (b.seo_impressions + b.seo_clicks) - (a.seo_impressions + a.seo_clicks));

    if (clientsWithData.length === 0) {
      console.log('❌ No clients found with SEO data in Dec 2025 - Jan 2026');
      console.log('\n📊 Showing ALL clients (even with 0 SEO data):');
      console.log('─'.repeat(80));

      // Show all clients data
      const allClientsData = Object.entries(clientData)
        .map(([clientId, data]) => ({
          clientId,
          name: clientMap[clientId]?.name || 'Unknown',
          slug: clientMap[clientId]?.slug || 'unknown',
          ...data
        }))
        .sort((a, b) => b.traffic_organic - a.traffic_organic);

      console.log('┌─────────────────────────────────────┬──────────┬────────┬────────┬─────────┐');
      console.log('│ Client Name                         │ Impr     │ Clicks │ Organic │ Branded │');
      console.log('├─────────────────────────────────────┼──────────┼────────┼────────┼─────────┤');

      allClientsData.slice(0, 20).forEach(c => {
        console.log(
          `│ ${c.name.substring(0, 35).padEnd(35)} │ ${String(c.seo_impressions).padStart(8)} │ ${String(c.seo_clicks).padStart(6)} │ ${String(c.traffic_organic).padStart(6)} │ ${String(c.branded_traffic).padStart(7)} │`
        );
      });

      console.log('└─────────────────────────────────────┴──────────┴────────┴────────┴─────────┘');
      return;
    }

    console.log(`📊 Clients with SEO data: ${clientsWithData.length}\n`);
    console.log('┌──────────────────────────────────────┬──────────┬────────┬────────┬─────────┐');
    console.log('│ Client Name                          │ Impr     │ Clicks │ Organic │ Branded │');
    console.log('├──────────────────────────────────────┼──────────┼────────┼────────┼─────────┤');

    clientsWithData.forEach((c, idx) => {
      console.log(
        `│ ${c.name.substring(0, 36).padEnd(36)} │ ${String(c.seo_impressions).padStart(8)} │ ${String(c.seo_clicks).padStart(6)} │ ${String(c.traffic_organic).padStart(6)} │ ${String(c.branded_traffic).padStart(7)} │`
      );
    });

    console.log('└──────────────────────────────────────┴──────────┴────────┴────────┴─────────┘');

    if (clientsWithData.length > 0) {
      const topClient = clientsWithData[0];
      console.log('\n🏆 TOP CLIENT:');
      console.log(`   ${topClient.name} (${topClient.slug})`);
      console.log(`   Impressions: ${topClient.seo_impressions.toLocaleString()}`);
      console.log(`   Clicks: ${topClient.seo_clicks.toLocaleString()}`);
      console.log(`   Organic Traffic: ${topClient.traffic_organic.toLocaleString()}`);
      console.log(`   URL: /admin-dashboard/${topClient.slug}/seo`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ANALYSIS COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findSEODataDecJan();
