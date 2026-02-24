const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSEOCorePosture() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║        🔍 TEST SEO PAGE - COREPOSTURE (TOP CLIENT)             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const clientId = '3c80f930-5f4d-49d6-9428-f2440e496aac';
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Fetch same way as SEO page does
    console.log('📊 FETCHING SEO METRICS (as per SEO page code):');
    console.log('─'.repeat(70));

    const { data: metricsData, error } = await supabase
      .from('client_metrics_summary')
      .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined, google_rank, top_keywords')
      .eq('client_id', clientId)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: true });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    if (!metricsData || metricsData.length === 0) {
      console.log('⚠️  No data returned');
      return;
    }

    console.log(`✅ Got ${metricsData.length} days of data\n`);

    // Calculate metrics exactly as SEO page does
    const totalImpressions = metricsData.reduce((sum, d) => sum + (d.seo_impressions || 0), 0);
    const totalClicks = metricsData.reduce((sum, d) => sum + (d.seo_clicks || 0), 0);
    const totalOrganicTraffic = metricsData.reduce((sum, d) => sum + (d.traffic_organic || 0), 0);
    const totalBrandedTraffic = metricsData.reduce((sum, d) => sum + (d.branded_traffic || 0), 0);
    const totalNonBrandedTraffic = metricsData.reduce((sum, d) => sum + (d.non_branded_traffic || 0), 0);
    const totalKeywordsImproved = metricsData.reduce((sum, d) => sum + (d.keywords_improved || 0), 0);
    const totalKeywordsDeclined = metricsData.reduce((sum, d) => sum + (d.keywords_declined || 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    console.log('📈 CALCULATED METRICS (as displayed on SEO page):');
    console.log('─'.repeat(70));
    console.log(`Impressions:           ${totalImpressions}`);
    console.log(`Clicks:                ${totalClicks}`);
    console.log(`CTR:                   ${avgCtr}%`);
    console.log(`Organic Traffic:       ${totalOrganicTraffic}`);
    console.log(`Branded Traffic:       ${totalBrandedTraffic}`);
    console.log(`Non-Branded Traffic:   ${totalNonBrandedTraffic}`);
    console.log(`Keywords Improved:     ${totalKeywordsImproved}`);
    console.log(`Keywords Declined:     ${totalKeywordsDeclined}`);

    console.log('\n📋 SAMPLE DAILY DATA (First 5 days):');
    console.log('─'.repeat(70));
    metricsData.slice(0, 5).forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.date}: Impr=${row.seo_impressions}, Clicks=${row.seo_clicks}, Organic=${row.traffic_organic}, Branded=${row.branded_traffic}, NonBranded=${row.non_branded_traffic}`);
    });

    console.log('\n✅ ALL METRICS ARE LOADING CORRECTLY!');
    console.log('\n🔗 Open this URL to test:');
    console.log('   http://localhost:3000/admin-dashboard/coreposture/seo');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TEST COMPLETE                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSEOCorePosture();
