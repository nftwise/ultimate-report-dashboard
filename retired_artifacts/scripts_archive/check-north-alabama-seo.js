const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkNorthAlabamaSEO() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║     🔍 CHECK NORTH ALABAMA SPINE & REHAB - SEO DATA            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get client ID for North Alabama
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, slug')
      .ilike('name', '%north alabama%')
      .limit(1);

    if (clientError) {
      console.log(`❌ Error finding client: ${clientError.message}`);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ Client not found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Found: ${client.name} (ID: ${client.id})\n`);

    // Check metrics for last 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Get SEO metrics
    console.log('📊 SEO METRICS FROM client_metrics_summary:');
    console.log('─'.repeat(70));

    const { data: metrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false })
      .limit(30);

    if (metricsError) {
      console.log(`❌ Error: ${metricsError.message}`);
    } else if (metrics && metrics.length > 0) {
      console.log(`✅ Found ${metrics.length} days of data\n`);

      // Aggregate
      const totalImpressions = metrics.reduce((s, r) => s + (r.seo_impressions || 0), 0);
      const totalClicks = metrics.reduce((s, r) => s + (r.seo_clicks || 0), 0);
      const totalOrganicTraffic = metrics.reduce((s, r) => s + (r.traffic_organic || 0), 0);
      const totalBrandedTraffic = metrics.reduce((s, r) => s + (r.branded_traffic || 0), 0);
      const totalNonBrandedTraffic = metrics.reduce((s, r) => s + (r.non_branded_traffic || 0), 0);
      const totalKeywordsImproved = metrics.reduce((s, r) => s + (r.keywords_improved || 0), 0);
      const totalKeywordsDeclined = metrics.reduce((s, r) => s + (r.keywords_declined || 0), 0);

      console.log('📈 AGGREGATED METRICS (30 days):');
      console.log(`  seo_impressions:    ${totalImpressions}`);
      console.log(`  seo_clicks:         ${totalClicks}`);
      console.log(`  traffic_organic:    ${totalOrganicTraffic}`);
      console.log(`  branded_traffic:    ${totalBrandedTraffic}`);
      console.log(`  non_branded_traffic: ${totalNonBrandedTraffic}`);
      console.log(`  keywords_improved:  ${totalKeywordsImproved}`);
      console.log(`  keywords_declined:  ${totalKeywordsDeclined}`);

      console.log('\n📋 SAMPLE DAILY DATA (Last 5 days):');
      console.log('─'.repeat(70));
      metrics.slice(0, 5).forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.date}:`);
        console.log(`   - Impressions: ${row.seo_impressions}, Clicks: ${row.seo_clicks}, CTR: ${row.seo_ctr}%`);
        console.log(`   - Organic Traffic: ${row.traffic_organic}, Branded: ${row.branded_traffic}, Non-Branded: ${row.non_branded_traffic}`);
      });
    } else {
      console.log('⚠️  No SEO metrics found');
    }

    // Also check if there are any records at all
    console.log('\n📊 CHECK ALL METRICS (ANY DATE):');
    console.log('─'.repeat(70));

    const { count: totalCount } = await supabase
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);

    console.log(`✅ Total client_metrics_summary rows for this client: ${totalCount}`);

    // Get date range for this client
    const { data: dateRange } = await supabase
      .from('client_metrics_summary')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabase
      .from('client_metrics_summary')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(1);

    if (dateRange && latestDate) {
      console.log(`📅 Data available from: ${dateRange[0]?.date} → ${latestDate[0]?.date}`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ CHECK COMPLETE                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkNorthAlabamaSEO();
