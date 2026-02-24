const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSeoTables() {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                  🔍 SCAN ALL SUPABASE TABLES FOR SEO/GSC DATA                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    // List of all possible SEO/GSC related tables
    const possibleTables = [
      'client_metrics_summary',
      'seo_keywords',
      'seo_rankings',
      'seo_performance',
      'gsc_data',
      'gsc_metrics',
      'gsc_keywords',
      'search_console_data',
      'search_console_keywords',
      'organic_traffic',
      'organic_keywords',
      'seo_pages',
      'top_pages',
      'keyword_rankings'
    ];

    console.log('📋 Checking for SEO/GSC tables...\n');

    let foundTables = [];

    for (const table of possibleTables) {
      try {
        const { data, error, status } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (status === 200 || (data && !error)) {
          console.log(`✅ ${table}: EXISTS`);
          foundTables.push(table);
        }
      } catch (e) {
        // Table doesn't exist
      }
    }

    console.log('\n' + '='.repeat(80));

    // For each found table, show structure
    if (foundTables.length > 0) {
      console.log(`\n🔍 DETAILS FOR FOUND TABLES:\n`);

      for (const table of foundTables) {
        console.log(`\n📊 TABLE: ${table.toUpperCase()}`);
        console.log('-'.repeat(80));

        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(3);

          if (error) {
            console.log(`  ❌ Error: ${error.message}`);
            continue;
          }

          if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log(`\n  Columns (${columns.length}):`);
            columns.forEach((col, i) => {
              console.log(`    ${i + 1}. ${col}`);
            });

            console.log(`\n  Sample Data (${data.length} rows):`);
            data.forEach((row, idx) => {
              console.log(`\n  Row ${idx + 1}:`);
              Object.entries(row).slice(0, 8).forEach(([key, value]) => {
                const displayValue = typeof value === 'object'
                  ? JSON.stringify(value).substring(0, 40)
                  : String(value).substring(0, 40);
                console.log(`    ${key}: ${displayValue}`);
              });
              if (Object.keys(row).length > 8) {
                console.log(`    ... and ${Object.keys(row).length - 8} more fields`);
              }
            });

            // Row count
            const { count } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });

            console.log(`\n  Total rows: ${count}`);
          }
        } catch (e) {
          console.log(`  Error: ${e.message}`);
        }
      }
    } else {
      console.log('\n❌ No SEO/GSC specific tables found.');
      console.log('\n📌 SEO data appears to be stored in: client_metrics_summary');
    }

    // Always show client_metrics_summary SEO fields
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SEO FIELDS IN client_metrics_summary:\n');

    const { data: sample } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .limit(1);

    if (sample && sample.length > 0) {
      const allFields = Object.keys(sample[0]);
      const seoFields = allFields.filter(f =>
        f.includes('seo') || f.includes('organic') || f.includes('keyword') || f.includes('traffic') || f.includes('rank')
      );

      console.log('SEO-related fields:');
      seoFields.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f}`);
      });

      console.log('\n📋 Full list of ALL fields in client_metrics_summary:');
      allFields.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f}`);
      });

      // Check for sample data with actual SEO values
      console.log('\n📅 Sample SEO data from client_metrics_summary:');
      const { data: metrics } = await supabase
        .from('client_metrics_summary')
        .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic, traffic_paid, traffic_direct, traffic_referral, top_keywords, google_rank, sessions, users')
        .order('date', { ascending: false })
        .limit(5);

      if (metrics) {
        metrics.forEach((m, idx) => {
          console.log(`\n  Row ${idx + 1} (${m.date}):`);
          console.log(`    seo_impressions: ${m.seo_impressions}`);
          console.log(`    seo_clicks: ${m.seo_clicks}`);
          console.log(`    seo_ctr: ${m.seo_ctr}`);
          console.log(`    traffic_organic: ${m.traffic_organic}`);
          console.log(`    traffic_paid: ${m.traffic_paid}`);
          console.log(`    traffic_direct: ${m.traffic_direct}`);
          console.log(`    traffic_referral: ${m.traffic_referral}`);
          console.log(`    top_keywords: ${m.top_keywords}`);
          console.log(`    google_rank: ${m.google_rank}`);
        });
      }
    }

    console.log('\n' + '╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           ✅ SCAN COMPLETE                                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSeoTables();
