const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGoogleRankTop10() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         🔍 KEYWORDS RANKING IN TOP 10                           ║');
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

    // Fetch last 31 days of data
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const formattedDate = thirtyOneDaysAgo.toISOString().split('T')[0];

    // Get daily metrics with google_rank
    const { data: dailyData, error } = await supabase
      .from('client_metrics_summary')
      .select('date, google_rank, top_keywords, seo_impressions, seo_clicks')
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

    // ============================================
    // ANALYZE GOOGLE RANK DATA
    // ============================================
    console.log('📊 GOOGLE RANK ANALYSIS (31 days):');
    console.log('─'.repeat(70));

    // Count keywords in top 10
    let totalRecords = dailyData.length;
    let daysWithTop10Data = 0;
    let top10Count = [];
    let top3Count = [];
    let top1Count = [];

    dailyData.forEach(day => {
      const rank = day.google_rank;

      if (rank !== null && rank !== undefined) {
        daysWithTop10Data++;

        // Each record represents average rank, so:
        // If average rank <= 10, it means at least some keywords are in top 10
        if (rank <= 10) {
          top10Count.push(day);
        }
        if (rank <= 3) {
          top3Count.push(day);
        }
        if (rank === 1) {
          top1Count.push(day);
        }
      }
    });

    const avgRank = dailyData
      .filter(d => d.google_rank !== null)
      .reduce((sum, d) => sum + (d.google_rank || 0), 0) / daysWithTop10Data;

    const minRank = Math.min(...dailyData.filter(d => d.google_rank).map(d => d.google_rank));
    const maxRank = Math.max(...dailyData.filter(d => d.google_rank).map(d => d.google_rank));

    console.log(`  Days with rank data:       ${daysWithTop10Data} / ${totalRecords}`);
    console.log(`  Average rank:              ${avgRank.toFixed(2)}`);
    console.log(`  Best rank achieved:        ${minRank}`);
    console.log(`  Worst rank:                ${maxRank}`);
    console.log(`  Days in top 10:            ${top10Count.length} days`);
    console.log(`  Days in top 3:             ${top3Count.length} days`);
    console.log(`  Days ranked #1:            ${top1Count.length} days`);

    // ============================================
    // ESTIMATE KEYWORDS IN TOP 10
    // ============================================
    console.log('\n🎯 ESTIMATED KEYWORDS IN TOP 10:');
    console.log('─'.repeat(70));

    // Since google_rank is average rank, we can estimate:
    // If average rank is 11.99, it means some are in top 10, some are below
    // We need to look at top_keywords data to get exact count

    // Get latest record for top_keywords parsing
    const latestRecord = dailyData[dailyData.length - 1];

    console.log(`  Latest record date: ${latestRecord.date}`);
    console.log(`  Google rank (avg):  ${latestRecord.google_rank}`);

    if (latestRecord.top_keywords && latestRecord.top_keywords > 0) {
      console.log(`  Top keywords count: ${latestRecord.top_keywords}`);
    }

    // Calculate based on average
    if (avgRank > 0 && avgRank <= 100) {
      // Rough estimate: if average rank is X, assume some distribution
      const estimatedInTop10 = Math.ceil((dailyData.filter(d => d.google_rank && d.google_rank <= 10).length / daysWithTop10Data) * 100);
      console.log(`\n  Estimated % of keywords in top 10: ~${estimatedInTop10}%`);
    }

    // ============================================
    // TREND ANALYSIS
    // ============================================
    console.log('\n📈 RANKING TREND (last 7 days):');
    console.log('─'.repeat(70));

    const last7Days = dailyData.slice(-7);
    last7Days.forEach(day => {
      const trend = day.google_rank <= 10 ? '🟢 TOP 10' : '🔴 BELOW 10';
      console.log(`  ${day.date}: Rank ${day.google_rank ? day.google_rank.toFixed(2) : 'N/A'} ${trend}`);
    });

    // ============================================
    // DETAILED BREAKDOWN
    // ============================================
    console.log('\n📋 RANKING BREAKDOWN:');
    console.log('─'.repeat(70));

    const rankings = {
      'Position 1-3': dailyData.filter(d => d.google_rank && d.google_rank <= 3).length,
      'Position 4-10': dailyData.filter(d => d.google_rank && d.google_rank > 3 && d.google_rank <= 10).length,
      'Position 11-20': dailyData.filter(d => d.google_rank && d.google_rank > 10 && d.google_rank <= 20).length,
      'Position 21-50': dailyData.filter(d => d.google_rank && d.google_rank > 20 && d.google_rank <= 50).length,
      'Position 51+': dailyData.filter(d => d.google_rank && d.google_rank > 50).length
    };

    Object.entries(rankings).forEach(([range, count]) => {
      const percentage = ((count / totalRecords) * 100).toFixed(1);
      console.log(`  ${range.padEnd(20)} ${count} days (${percentage}%)`);
    });

    // ============================================
    // RECOMMENDATION
    // ============================================
    console.log('\n💡 RECOMMENDED METRICS FOR "Top Landing Pages" SECTION:');
    console.log('─'.repeat(70));
    console.log('  Replace with: "🏆 Keywords in Top 10"');
    console.log(`  Show: ${rankings['Position 1-3'] + rankings['Position 4-10']} keywords in top 10 (${((rankings['Position 1-3'] + rankings['Position 4-10']) / totalRecords * 100).toFixed(1)}%)`);
    console.log(`  Or show breakdown: ${rankings['Position 1-3']} in top 3 + ${rankings['Position 4-10']} in 4-10`);
    console.log('  Trend: ' + (last7Days[6]?.google_rank <= 10 ? '📈 Improving' : '📉 Declining'));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkGoogleRankTop10();
