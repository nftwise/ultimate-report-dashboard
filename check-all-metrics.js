const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllMetrics() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         🔍 CHECK ALL TABLES & METRICS (GA4 + GSC)              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get a sample client with data
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug')
      .limit(1);

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.name}\n`);

    // Check client_metrics_summary table
    console.log('📊 TABLE: client_metrics_summary');
    console.log('─'.repeat(70));

    const { data: metrics, error } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', client.id)
      .limit(1);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else if (metrics && metrics.length > 0) {
      const row = metrics[0];
      const allFields = Object.keys(row).sort();

      console.log(`✅ Found ${allFields.length} fields:\n`);

      // Group by type
      const ga4Fields = [];
      const gscFields = [];
      const otherFields = [];

      allFields.forEach(field => {
        if (field.includes('traffic') || field.includes('session') || field.includes('user') || field === 'bounce_rate' || field === 'avg_session_duration') {
          ga4Fields.push(field);
        } else if (field.includes('seo_') || field.includes('keyword') || field.includes('rank') || field === 'top_keywords') {
          gscFields.push(field);
        } else {
          otherFields.push(field);
        }
      });

      if (ga4Fields.length > 0) {
        console.log('📈 GA4 FIELDS:');
        ga4Fields.forEach((f, idx) => {
          const val = row[f];
          console.log(`  ${idx + 1}. ${f.padEnd(30)} = ${val !== null ? val : 'NULL'}`);
        });
      }

      if (gscFields.length > 0) {
        console.log('\n📋 GSC FIELDS:');
        gscFields.forEach((f, idx) => {
          const val = row[f];
          console.log(`  ${idx + 1}. ${f.padEnd(30)} = ${val !== null ? val : 'NULL'}`);
        });
      }

      if (otherFields.length > 0) {
        console.log('\n🔧 OTHER FIELDS:');
        otherFields.forEach((f, idx) => {
          const val = row[f];
          console.log(`  ${idx + 1}. ${f.padEnd(30)} = ${val !== null ? (typeof val === 'string' && val.length > 30 ? val.substring(0, 30) + '...' : val) : 'NULL'}`);
        });
      }
    }

    // Check other tables
    console.log('\n\n📂 OTHER TABLES AVAILABLE:');
    console.log('─'.repeat(70));

    const tables = [
      'gsc_queries',
      'gsc_pages',
      'ads_ad_group_metrics',
      'campaign_search_terms',
      'google_ads_call_metrics',
      'gbp_metrics'
    ];

    for (const table of tables) {
      const { data: tableData, error: tableError } = await supabase
        .from(table)
        .select('*')
        .eq('client_id', client.id)
        .limit(1);

      if (tableError) {
        console.log(`\n❌ ${table}: ${tableError.message}`);
      } else if (tableData && tableData.length > 0) {
        const fields = Object.keys(tableData[0]);
        console.log(`\n✅ ${table}: ${fields.length} fields`);
        console.log(`   Fields: ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? ' ...' : ''}`);
      } else {
        console.log(`\n⚠️  ${table}: No data for this client`);
      }
    }

    // Summary
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 SUMMARY                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('🎯 CURRENTLY SHOWING IN SEO PAGE:');
    console.log('  ✅ User Sessions (GA4)');
    console.log('  ✅ Users (GA4)');
    console.log('  ✅ CTR (GSC)');
    console.log('  ✅ Organic Traffic (GA4)');
    console.log('  ✅ Branded Traffic');
    console.log('  ✅ Non-Branded Traffic');
    console.log('  ✅ Keywords Improved');
    console.log('  ✅ Keywords Declined');
    console.log('  ✅ SEO Impressions (GSC)');
    console.log('  ✅ SEO Clicks (GSC)');
    console.log('  ✅ Daily Performance Chart (User Sessions + Organic Traffic)');

    console.log('\n💡 POSSIBLE METRICS TO ADD:');
    console.log('  • Bounce Rate (GA4)');
    console.log('  • Avg Session Duration (GA4)');
    console.log('  • Traffic from Direct');
    console.log('  • Traffic from Paid');
    console.log('  • Traffic from Referral');
    console.log('  • Google Rank (GSC)');
    console.log('  • Top Keywords (GSC)');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllMetrics();
