const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDeCarloDetailed() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          🔍 DECARLO CHIROPRACTIC - DETAILED SEO DATA            ║');
    console.log('║              (December 2025 - January 2026)                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get DeCarlo client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, slug, industry, city')
      .ilike('name', '%decarlo%')
      .limit(1);

    if (clientError) {
      console.log(`❌ Error: ${clientError.message}`);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ DeCarlo not found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Client: ${client.name}`);
    console.log(`   Industry: ${client.industry}`);
    console.log(`   City: ${client.city}`);
    console.log(`   ID: ${client.id}\n`);

    const dateFromISO = '2025-12-01';
    const dateToISO = '2026-01-31';

    console.log(`📅 Date range: ${dateFromISO} → ${dateToISO}\n`);

    // Fetch metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: false });

    if (metricsError) {
      console.log(`❌ Error: ${metricsError.message}`);
      return;
    }

    if (!metrics || metrics.length === 0) {
      console.log('⚠️  No data found');
      return;
    }

    console.log(`📊 Found ${metrics.length} days of data\n`);

    // Calculate totals
    const totalImpressions = metrics.reduce((s, r) => s + (r.seo_impressions || 0), 0);
    const totalClicks = metrics.reduce((s, r) => s + (r.seo_clicks || 0), 0);
    const totalOrganicTraffic = metrics.reduce((s, r) => s + (r.traffic_organic || 0), 0);
    const totalBrandedTraffic = metrics.reduce((s, r) => s + (r.branded_traffic || 0), 0);
    const totalNonBrandedTraffic = metrics.reduce((s, r) => s + (r.non_branded_traffic || 0), 0);
    const totalKeywordsImproved = metrics.reduce((s, r) => s + (r.keywords_improved || 0), 0);
    const totalKeywordsDeclined = metrics.reduce((s, r) => s + (r.keywords_declined || 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    console.log('📈 TOTAL METRICS (Dec 1, 2025 - Jan 31, 2026):');
    console.log('─'.repeat(70));
    console.log(`✨ Impressions:        ${totalImpressions.toLocaleString()}`);
    console.log(`✨ Clicks:             ${totalClicks.toLocaleString()}`);
    console.log(`✨ CTR:                ${avgCtr}%`);
    console.log(`✨ Organic Traffic:    ${totalOrganicTraffic.toLocaleString()}`);
    console.log(`✨ Branded Traffic:    ${totalBrandedTraffic.toLocaleString()}`);
    console.log(`✨ Non-Branded Traffic: ${totalNonBrandedTraffic.toLocaleString()}`);
    console.log(`✨ Keywords Improved:  ${totalKeywordsImproved.toLocaleString()}`);
    console.log(`✨ Keywords Declined:  ${totalKeywordsDeclined.toLocaleString()}`);

    // December breakdown
    const decemberMetrics = metrics.filter(d => d.date.startsWith('2025-12'));
    if (decemberMetrics.length > 0) {
      console.log('\n📅 DECEMBER 2025:');
      console.log('─'.repeat(70));
      const decImpr = decemberMetrics.reduce((s, r) => s + (r.seo_impressions || 0), 0);
      const decClicks = decemberMetrics.reduce((s, r) => s + (r.seo_clicks || 0), 0);
      const decOrg = decemberMetrics.reduce((s, r) => s + (r.traffic_organic || 0), 0);
      const decBranded = decemberMetrics.reduce((s, r) => s + (r.branded_traffic || 0), 0);
      const decNonBranded = decemberMetrics.reduce((s, r) => s + (r.non_branded_traffic || 0), 0);
      const decCtr = decImpr > 0 ? ((decClicks / decImpr) * 100).toFixed(2) : 0;

      console.log(`  Days: ${decemberMetrics.length}`);
      console.log(`  Impressions: ${decImpr.toLocaleString()}`);
      console.log(`  Clicks: ${decClicks.toLocaleString()}`);
      console.log(`  CTR: ${decCtr}%`);
      console.log(`  Organic Traffic: ${decOrg.toLocaleString()}`);
      console.log(`  Branded: ${decBranded.toLocaleString()} | Non-Branded: ${decNonBranded.toLocaleString()}`);
    }

    // January breakdown
    const januaryMetrics = metrics.filter(d => d.date.startsWith('2026-01'));
    if (januaryMetrics.length > 0) {
      console.log('\n📅 JANUARY 2026:');
      console.log('─'.repeat(70));
      const janImpr = januaryMetrics.reduce((s, r) => s + (r.seo_impressions || 0), 0);
      const janClicks = januaryMetrics.reduce((s, r) => s + (r.seo_clicks || 0), 0);
      const janOrg = januaryMetrics.reduce((s, r) => s + (r.traffic_organic || 0), 0);
      const janBranded = januaryMetrics.reduce((s, r) => s + (r.branded_traffic || 0), 0);
      const janNonBranded = januaryMetrics.reduce((s, r) => s + (r.non_branded_traffic || 0), 0);
      const janCtr = janImpr > 0 ? ((janClicks / janImpr) * 100).toFixed(2) : 0;

      console.log(`  Days: ${januaryMetrics.length}`);
      console.log(`  Impressions: ${janImpr.toLocaleString()}`);
      console.log(`  Clicks: ${janClicks.toLocaleString()}`);
      console.log(`  CTR: ${janCtr}%`);
      console.log(`  Organic Traffic: ${janOrg.toLocaleString()}`);
      console.log(`  Branded: ${janBranded.toLocaleString()} | Non-Branded: ${janNonBranded.toLocaleString()}`);
    }

    // Daily breakdown
    console.log('\n📋 DAILY DATA:');
    console.log('─'.repeat(70));
    console.log('Date       │ Impressions │ Clicks │ CTR    │ Organic │ Branded │ NonBrand │ KWImpr │ KWDecl');
    console.log('─'.repeat(70));

    metrics.forEach(row => {
      const ctr = (row.seo_impressions || 0) > 0 ? ((row.seo_clicks / row.seo_impressions) * 100).toFixed(2) : '0.00';
      console.log(
        `${row.date} │ ${String(row.seo_impressions || 0).padStart(11)} │ ${String(row.seo_clicks || 0).padStart(5)} │ ${String(ctr).padStart(6)} │ ${String(row.traffic_organic || 0).padStart(7)} │ ${String(row.branded_traffic || 0).padStart(7)} │ ${String(row.non_branded_traffic || 0).padStart(8)} │ ${String(row.keywords_improved || 0).padStart(6)} │ ${String(row.keywords_declined || 0).padStart(6)}`
      );
    });

    // Top days
    console.log('\n🏆 TOP 5 PERFORMING DAYS (by impressions):');
    console.log('─'.repeat(70));
    const topDays = metrics
      .sort((a, b) => (b.seo_impressions || 0) - (a.seo_impressions || 0))
      .slice(0, 5);

    topDays.forEach((day, idx) => {
      const ctr = (day.seo_impressions || 0) > 0 ? ((day.seo_clicks / day.seo_impressions) * 100).toFixed(2) : '0.00';
      console.log(
        `${idx + 1}. ${day.date}: ${day.seo_impressions} impr, ${day.seo_clicks} clicks, ${ctr}% CTR, ${day.traffic_organic} organic`
      );
    });

    // All available fields
    console.log('\n✅ All fields available in client_metrics_summary:');
    console.log('─'.repeat(70));
    if (metrics.length > 0) {
      Object.keys(metrics[0]).forEach((field, idx) => {
        console.log(`${idx + 1}. ${field}`);
      });
    }

    console.log('\n🔗 View this client in SEO dashboard:');
    console.log(`   http://localhost:3000/admin-dashboard/${client.slug}/seo`);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ANALYSIS COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDeCarloDetailed();
