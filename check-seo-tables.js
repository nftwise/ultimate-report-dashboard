const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSeoTables() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          🔍 SEO TABLES SCHEMA & DATA CHECK                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Check gsc_queries table
    console.log('📋 TABLE: gsc_queries');
    console.log('─'.repeat(70));
    const { data: gscQueriesSample, error: gscQueriesError } = await supabase
      .from('gsc_queries')
      .select('*')
      .limit(1);

    if (gscQueriesError) {
      console.log(`❌ Error: ${gscQueriesError.message}`);
    } else if (gscQueriesSample && gscQueriesSample.length > 0) {
      const row = gscQueriesSample[0];
      console.log('Columns:');
      Object.keys(row).forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col} = ${row[col]}`);
      });
    } else {
      console.log('⚠️  Table is empty');
    }

    // Check gsc_pages table
    console.log('\n📋 TABLE: gsc_pages');
    console.log('─'.repeat(70));
    const { data: gscPagesSample, error: gscPagesError } = await supabase
      .from('gsc_pages')
      .select('*')
      .limit(1);

    if (gscPagesError) {
      console.log(`❌ Error: ${gscPagesError.message}`);
    } else if (gscPagesSample && gscPagesSample.length > 0) {
      const row = gscPagesSample[0];
      console.log('Columns:');
      Object.keys(row).forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col} = ${row[col]}`);
      });
    } else {
      console.log('⚠️  Table is empty');
    }

    // Check client_metrics_summary for SEO fields
    console.log('\n📋 TABLE: client_metrics_summary (SEO Fields Only)');
    console.log('─'.repeat(70));
    const { data: metricsData, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .limit(1);

    if (metricsError) {
      console.log(`❌ Error: ${metricsError.message}`);
    } else if (metricsData && metricsData.length > 0) {
      const row = metricsData[0];
      const seoFields = Object.keys(row).filter(col =>
        col.includes('seo') || col.includes('organic') || col.includes('keyword') ||
        col.includes('branded') || col.includes('rank') || col.includes('traffic')
      );

      console.log('SEO-related columns:');
      seoFields.forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col}`);
      });

      console.log('\nSample values:');
      seoFields.forEach(col => {
        const val = row[col];
        console.log(`  ${col}: ${val} (${typeof val})`);
      });
    } else {
      console.log('⚠️  Table is empty');
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ CHECK COMPLETE                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSeoTables();
