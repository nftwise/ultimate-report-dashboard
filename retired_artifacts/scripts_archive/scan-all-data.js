const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scanAllData() {
  try {
    console.log('🔍 SCANNING ALL SUPABASE TABLES - COMPLETE DATA');
    console.log('='.repeat(80));

    const tableNames = [
      'clients',
      'client_metrics_summary',
      'ads_ad_group_metrics',
      'ads_campaign_metrics',
      'campaign_search_terms',
      'campaign_conversion_actions',
      'ga4_conversions',
      'google_ads_call_metrics',
      'google_ads_ad_performance',
      'ads_insights',
      'ads_correlation_patterns'
    ];

    for (const tableName of tableNames) {
      console.log(`\n\n📋 TABLE: ${tableName}`);
      console.log('-'.repeat(80));

      try {
        // Get sample row to understand columns
        const { data: sample, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (sampleError) {
          console.log(`❌ Error: ${sampleError.message}`);
          continue;
        }

        if (!sample || sample.length === 0) {
          console.log('⚠️  No data in table');
          continue;
        }

        // Get columns
        const columns = Object.keys(sample[0]);
        console.log(`\n📌 Columns (${columns.length}):`);
        columns.forEach((col, i) => {
          console.log(`   ${i + 1}. ${col}`);
        });

        // Get row count
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        console.log(`\n📊 Total rows: ${count || 'unknown'}`);

        // Get sample data (first 3 rows)
        const { data: rows, error: rowError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);

        if (rows && rows.length > 0) {
          console.log(`\n📝 Sample data (${rows.length} row(s)):`);
          rows.forEach((row, idx) => {
            console.log(`\n   Row ${idx + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              const displayValue = typeof value === 'object'
                ? JSON.stringify(value).substring(0, 50)
                : String(value).substring(0, 50);
              console.log(`      ${key}: ${displayValue}`);
            });
          });
        }

      } catch (error) {
        console.log(`❌ Error fetching table: ${error.message}`);
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ SCAN COMPLETE');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

scanAllData();
