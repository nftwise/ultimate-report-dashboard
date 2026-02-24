const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function queryAllTables() {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 COMPLETE SUPABASE QUERY CONSOLE                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    // List all tables
    const tables = [
      'clients',
      'client_metrics_summary',
      'ads_campaign_metrics',
      'ads_ad_group_metrics',
      'campaign_search_terms',
      'campaign_conversion_actions',
      'google_ads_call_metrics',
      'ads_insights',
      'ads_correlation_patterns',
      'google_ads_ad_performance',
      'gbp_location_metrics',
      'gbp_review_metrics',
      'gbp_call_metrics'
    ];

    for (const table of tables) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`📋 TABLE: ${table.toUpperCase()}`);
      console.log(`${'═'.repeat(80)}`);

      try {
        // Get count
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.log(`❌ Error: ${countError.message}`);
          continue;
        }

        console.log(`✅ Total Rows: ${count || 0}\n`);

        if (count === 0) {
          console.log('⚠️  Table is empty');
          continue;
        }

        // Get sample row to show schema
        const { data: sample, error: sampleError } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (sampleError) {
          console.log(`❌ Error fetching sample: ${sampleError.message}`);
          continue;
        }

        if (sample && sample.length > 0) {
          const row = sample[0];
          const columns = Object.keys(row);

          console.log(`📊 SCHEMA (${columns.length} columns):`);
          console.log('─'.repeat(80));
          columns.forEach((col, idx) => {
            const value = row[col];
            const type = typeof value;
            console.log(`  ${idx + 1}. ${col.padEnd(30)} │ ${type.padEnd(15)} │ Value: ${String(value).substring(0, 40)}`);
          });

          // Get date range if date column exists
          if (columns.includes('date')) {
            const { data: dates } = await supabase
              .from(table)
              .select('date')
              .order('date', { ascending: true })
              .limit(1);

            const { data: latestDates } = await supabase
              .from(table)
              .select('date')
              .order('date', { ascending: false })
              .limit(1);

            if (dates && latestDates) {
              console.log(`\n📅 Date Range: ${dates[0]?.date} → ${latestDates[0]?.date}`);
            }
          }

          // Get client_id range if exists
          if (columns.includes('client_id')) {
            const { data: clients } = await supabase
              .from(table)
              .select('client_id')
              .limit(5);

            console.log(`\n👥 Sample Client IDs:`);
            const uniqueClients = [...new Set(clients?.map(c => c.client_id) || [])];
            uniqueClients.forEach(cid => console.log(`   - ${cid}`));
          }

          // Get total metrics if numeric columns exist
          const numericCols = columns.filter(col => {
            const val = row[col];
            return typeof val === 'number' && !col.includes('id');
          });

          if (numericCols.length > 0) {
            console.log(`\n📈 Aggregated Metrics (first 5 numeric columns):`);
            console.log('─'.repeat(80));

            for (const col of numericCols.slice(0, 5)) {
              const { data: stats } = await supabase
                .from(table)
                .select(col);

              if (stats) {
                const sum = stats.reduce((s, r) => s + (r[col] || 0), 0);
                const avg = sum / stats.length;
                const max = Math.max(...stats.map(r => r[col] || 0));
                const min = Math.min(...stats.map(r => r[col] || 0));

                console.log(`  ${col.padEnd(30)} │ SUM: ${sum.toFixed(2).padStart(12)} │ AVG: ${avg.toFixed(2).padStart(10)} │ MAX: ${max.toFixed(2).padStart(10)} │ MIN: ${min.toFixed(2).padStart(10)}`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        ✅ QUERY COMPLETE                                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryAllTables();
