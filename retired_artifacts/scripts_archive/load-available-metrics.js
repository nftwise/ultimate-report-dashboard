const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function loadAvailableMetrics() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         📊 LOAD AVAILABLE REPLACEMENT METRICS                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get the first client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug')
      .limit(1);

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.name} (${client.slug})\n`);

    // Fetch last 31 days of data with all available metrics
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const formattedDate = thirtyOneDaysAgo.toISOString().split('T')[0];

    // Get full data
    const { data: dailyData, error } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', formattedDate)
      .order('date', { ascending: true });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    if (!dailyData || dailyData.length === 0) {
      console.log('⚠️  No data found');
      return;
    }

    console.log(`✅ Found ${dailyData.length} days of data\n`);

    // Get latest record for detailed inspection
    const latest = dailyData[dailyData.length - 1];

    // ============================================
    // GA4 METRICS FOR LANDING PAGES
    // ============================================
    console.log('📄 GA4 METRICS (for Landing Pages section):');
    console.log('─'.repeat(70));

    const gaMetrics = ['bounce_rate', 'avg_session_duration', 'pages_per_session',
                       'top_landing_pages', 'new_users', 'returning_users'];

    gaMetrics.forEach(metric => {
      const val = latest[metric];
      console.log(`  ${metric.padEnd(30)} = ${val !== null ? (typeof val === 'object' ? JSON.stringify(val).substring(0, 60) : val) : 'NULL'}`);
    });

    // ============================================
    // GSC METRICS FOR KEYWORDS
    // ============================================
    console.log('\n🔑 GSC METRICS (for Keywords section):');
    console.log('─'.repeat(70));

    const gscMetrics = ['top_keywords', 'google_rank', 'seo_impressions', 'seo_clicks', 'seo_ctr'];

    gscMetrics.forEach(metric => {
      const val = latest[metric];
      if (metric === 'top_keywords') {
        console.log(`  ${metric.padEnd(30)} = ${typeof val === 'object' ? JSON.stringify(val, null, 2).substring(0, 80) : val}`);
      } else {
        console.log(`  ${metric.padEnd(30)} = ${val !== null ? val : 'NULL'}`);
      }
    });

    // ============================================
    // AGGREGATED METRICS (31 days)
    // ============================================
    console.log('\n📊 AGGREGATED METRICS (31 days total):');
    console.log('─'.repeat(70));

    const avgBounceRate = (dailyData.reduce((sum, d) => sum + (d.bounce_rate || 0), 0) / dailyData.length).toFixed(2);
    const avgSessionDuration = (dailyData.reduce((sum, d) => sum + (d.avg_session_duration || 0), 0) / dailyData.length).toFixed(2);
    const avgPagesPerSession = (dailyData.reduce((sum, d) => sum + (d.pages_per_session || 0), 0) / dailyData.length).toFixed(2);
    const totalNewUsers = dailyData.reduce((sum, d) => sum + (d.new_users || 0), 0);
    const totalReturningUsers = dailyData.reduce((sum, d) => sum + (d.returning_users || 0), 0);
    const avgGoogleRank = (dailyData.reduce((sum, d) => sum + (d.google_rank || 0), 0) / dailyData.filter(d => d.google_rank).length).toFixed(2);

    console.log(`  Avg Bounce Rate:           ${avgBounceRate}%`);
    console.log(`  Avg Session Duration:      ${avgSessionDuration}s`);
    console.log(`  Avg Pages/Session:         ${avgPagesPerSession}`);
    console.log(`  Total New Users:           ${totalNewUsers}`);
    console.log(`  Total Returning Users:     ${totalReturningUsers}`);
    console.log(`  Avg Google Rank:           ${avgGoogleRank}`);

    // ============================================
    // TOP LANDING PAGES (parse if available)
    // ============================================
    console.log('\n📑 TOP LANDING PAGES (latest record):');
    console.log('─'.repeat(70));

    const topLandingPages = latest.top_landing_pages;
    if (topLandingPages) {
      if (typeof topLandingPages === 'string') {
        try {
          const parsed = JSON.parse(topLandingPages);
          console.log(JSON.stringify(parsed, null, 2).substring(0, 300));
        } catch (e) {
          console.log(`Raw data: ${topLandingPages.substring(0, 100)}`);
        }
      } else if (typeof topLandingPages === 'object') {
        console.log(JSON.stringify(topLandingPages, null, 2).substring(0, 300));
      } else {
        console.log(`Type: ${typeof topLandingPages}, Value: ${topLandingPages}`);
      }
    } else {
      console.log('No data available');
    }

    // ============================================
    // TOP KEYWORDS (parse if available)
    // ============================================
    console.log('\n\n🔑 TOP KEYWORDS (latest record):');
    console.log('─'.repeat(70));

    const topKeywords = latest.top_keywords;
    if (topKeywords) {
      if (typeof topKeywords === 'string') {
        try {
          const parsed = JSON.parse(topKeywords);
          console.log(JSON.stringify(parsed, null, 2).substring(0, 400));
        } catch (e) {
          console.log(`Raw data: ${topKeywords.substring(0, 150)}`);
        }
      } else if (typeof topKeywords === 'object') {
        console.log(JSON.stringify(topKeywords, null, 2).substring(0, 400));
      } else {
        console.log(`Type: ${typeof topKeywords}, Value: ${topKeywords}`);
      }
    } else {
      console.log('No data available');
    }

    // ============================================
    // RECOMMENDATIONS
    // ============================================
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(70));
    console.log('For "Top Landing Pages" section, you can show:');
    console.log('  ✓ Parse top_landing_pages JSON if available');
    console.log('  ✓ Show Bounce Rate, Avg Session Duration, Pages/Session');
    console.log('\nFor "Top Keywords" section, you can show:');
    console.log('  ✓ Parse top_keywords JSON from GSC');
    console.log('  ✓ Show with Impressions, Clicks, and CTR');
    console.log('  ✓ Or create a summary: Keywords Improved vs Declined');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

loadAvailableMetrics();
