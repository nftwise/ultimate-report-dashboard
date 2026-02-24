const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRayChiroSEO() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           🔍 RAY CHIROPRACTIC - COMPLETE SEO DATA              ║');
    console.log('║              (December 2025 - January 2026)                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get Ray Chiro client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, slug')
      .ilike('name', '%ray chiro%')
      .limit(1);

    if (clientError) {
      console.log(`❌ Error finding client: ${clientError.message}`);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ Ray Chiropractic not found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Found: ${client.name} (ID: ${client.id})\n`);

    // Date range: December 1, 2025 to January 31, 2026
    const dateFromISO = '2025-12-01';
    const dateToISO = '2026-01-31';

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Fetch all SEO metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic, branded_traffic, non_branded_traffic, keywords_improved, keywords_declined, google_rank, top_keywords')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false });

    if (metricsError) {
      console.log(`❌ Error: ${metricsError.message}`);
      return;
    }

    if (!metrics || metrics.length === 0) {
      console.log('⚠️  No SEO metrics found for this period');
      return;
    }

    console.log(`📊 Found ${metrics.length} days of data\n`);

    // Calculate aggregates
    const totalImpressions = metrics.reduce((s, r) => s + (r.seo_impressions || 0), 0);
    const totalClicks = metrics.reduce((s, r) => s + (r.seo_clicks || 0), 0);
    const totalOrganicTraffic = metrics.reduce((s, r) => s + (r.traffic_organic || 0), 0);
    const totalBrandedTraffic = metrics.reduce((s, r) => s + (r.branded_traffic || 0), 0);
    const totalNonBrandedTraffic = metrics.reduce((s, r) => s + (r.non_branded_traffic || 0), 0);
    const totalKeywordsImproved = metrics.reduce((s, r) => s + (r.keywords_improved || 0), 0);
    const totalKeywordsDeclined = metrics.reduce((s, r) => s + (r.keywords_declined || 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    console.log('📈 AGGREGATED METRICS (Dec 1, 2025 - Jan 31, 2026):');
    console.log('─'.repeat(70));
    console.log(`  Impressions:        ${totalImpressions.toLocaleString()}`);
    console.log(`  Clicks:             ${totalClicks.toLocaleString()}`);
    console.log(`  CTR:                ${avgCtr}%`);
    console.log(`  Organic Traffic:    ${totalOrganicTraffic.toLocaleString()}`);
    console.log(`  Branded Traffic:    ${totalBrandedTraffic.toLocaleString()}`);
    console.log(`  Non-Branded Traffic: ${totalNonBrandedTraffic.toLocaleString()}`);
    console.log(`  Keywords Improved:  ${totalKeywordsImproved.toLocaleString()}`);
    console.log(`  Keywords Declined:  ${totalKeywordsDeclined.toLocaleString()}`);

    // December data
    const decemberData = metrics.filter(d => d.date.startsWith('2025-12'));
    const januaryData = metrics.filter(d => d.date.startsWith('2026-01'));

    if (decemberData.length > 0) {
      console.log('\n📅 DECEMBER 2025 DATA:');
      console.log('─'.repeat(70));
      const decImpr = decemberData.reduce((s, r) => s + (r.seo_impressions || 0), 0);
      const decClicks = decemberData.reduce((s, r) => s + (r.seo_clicks || 0), 0);
      const decOrg = decemberData.reduce((s, r) => s + (r.traffic_organic || 0), 0);
      const decCtr = decImpr > 0 ? ((decClicks / decImpr) * 100).toFixed(2) : 0;

      console.log(`  Days: ${decemberData.length}`);
      console.log(`  Impressions: ${decImpr.toLocaleString()} | Clicks: ${decClicks.toLocaleString()} | CTR: ${decCtr}%`);
      console.log(`  Organic Traffic: ${decOrg.toLocaleString()}`);
    }

    if (januaryData.length > 0) {
      console.log('\n📅 JANUARY 2026 DATA:');
      console.log('─'.repeat(70));
      const janImpr = januaryData.reduce((s, r) => s + (r.seo_impressions || 0), 0);
      const janClicks = januaryData.reduce((s, r) => s + (r.seo_clicks || 0), 0);
      const janOrg = januaryData.reduce((s, r) => s + (r.traffic_organic || 0), 0);
      const janCtr = janImpr > 0 ? ((janClicks / janImpr) * 100).toFixed(2) : 0;

      console.log(`  Days: ${januaryData.length}`);
      console.log(`  Impressions: ${janImpr.toLocaleString()} | Clicks: ${janClicks.toLocaleString()} | CTR: ${janCtr}%`);
      console.log(`  Organic Traffic: ${janOrg.toLocaleString()}`);
    }

    // Show daily data
    console.log('\n📋 DAILY BREAKDOWN (All Days):');
    console.log('─'.repeat(70));
    console.log('Date         │ Impressions │ Clicks │ CTR   │ Organic │ Branded │ Non-Br │ Impr ↑ │ Impr ↓');
    console.log('─'.repeat(70));

    metrics.forEach(row => {
      const ctr = (row.seo_impressions || 0) > 0 ? ((row.seo_clicks / row.seo_impressions) * 100).toFixed(2) : '0.00';
      console.log(
        `${row.date} │ ${String(row.seo_impressions || 0).padStart(11)} │ ${String(row.seo_clicks || 0).padStart(5)} │ ${String(ctr).padStart(5)} │ ${String(row.traffic_organic || 0).padStart(7)} │ ${String(row.branded_traffic || 0).padStart(7)} │ ${String(row.non_branded_traffic || 0).padStart(6)} │ ${String(row.keywords_improved || 0).padStart(6)} │ ${String(row.keywords_declined || 0).padStart(6)}`
      );
    });

    // Top performing days
    console.log('\n🏆 TOP PERFORMING DAYS (by impressions):');
    console.log('─'.repeat(70));
    const topDays = metrics
      .sort((a, b) => (b.seo_impressions || 0) - (a.seo_impressions || 0))
      .slice(0, 5);

    topDays.forEach((day, idx) => {
      const ctr = (day.seo_impressions || 0) > 0 ? ((day.seo_clicks / day.seo_impressions) * 100).toFixed(2) : '0.00';
      console.log(
        `${idx + 1}. ${day.date}: ${day.seo_impressions} impressions, ${day.seo_clicks} clicks, ${ctr}% CTR, ${day.traffic_organic} organic traffic`
      );
    });

    console.log('\n✅ All available fields from client_metrics_summary:');
    console.log('─'.repeat(70));
    if (metrics.length > 0) {
      const allFields = Object.keys(metrics[0]);
      allFields.forEach((field, idx) => {
        console.log(`${idx + 1}. ${field}`);
      });
    }

    console.log('\n🔗 View in SEO Dashboard: /admin-dashboard/' + client.slug + '/seo');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ANALYSIS COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRayChiroSEO();
