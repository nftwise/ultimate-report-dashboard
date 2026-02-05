const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSeoData() {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                     🔍 CHECK SEO DATA IN SUPABASE                              ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    // Get all tables to see what's available for SEO
    console.log('📋 Scanning for SEO-related tables...\n');

    const tables = [
      'client_metrics_summary',
      'seo_keywords',
      'seo_rankings',
      'seo_performance',
      'search_console_data',
      'organic_traffic'
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (!error && data) {
          console.log(`✅ ${table}: EXISTS`);
        }
      } catch (e) {
        // Table doesn't exist
      }
    }

    // Check client_metrics_summary for SEO fields
    console.log('\n📊 SEO Fields in client_metrics_summary:\n');

    const { data: sample } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .limit(1);

    if (sample && sample.length > 0) {
      const allFields = Object.keys(sample[0]);
      const seoFields = allFields.filter(f =>
        f.includes('seo') || f.includes('organic') || f.includes('keyword') || f.includes('traffic')
      );

      console.log('SEO-related fields:');
      seoFields.forEach(f => {
        console.log(`  - ${f}`);
      });

      console.log('\n📊 Sample SEO data:');
      const row = sample[0];
      seoFields.forEach(f => {
        console.log(`  ${f}: ${row[f]}`);
      });

      // Check date range
      const { data: dates } = await supabase
        .from('client_metrics_summary')
        .select('date, seo_impressions, seo_clicks, seo_ctr, traffic_organic')
        .order('date', { ascending: false })
        .limit(10);

      if (dates && dates.length > 0) {
        console.log('\n📅 Recent SEO data (last 10 days):');
        dates.forEach(d => {
          console.log(`  ${d.date}: Impr=${d.seo_impressions}, Clicks=${d.seo_clicks}, CTR=${d.seo_ctr}%, Organic=${d.traffic_organic}`);
        });
      }
    }

    console.log('\n' + '╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                            ✅ CHECK COMPLETE                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSeoData();
