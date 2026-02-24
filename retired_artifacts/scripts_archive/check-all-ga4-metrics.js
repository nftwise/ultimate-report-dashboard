const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllGA4Metrics() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         🔍 ALL GA4 METRICS FROM SUPABASE                         ║');
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

    // Fetch one row to see all fields
    const { data: metrics, error } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .eq('client_id', client.id)
      .limit(1);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    if (!metrics || metrics.length === 0) {
      console.log('⚠️  No metrics data for this client');
      return;
    }

    const row = metrics[0];
    const allFields = Object.keys(row).sort();

    console.log(`📊 TOTAL FIELDS: ${allFields.length}\n`);

    // Separate GA4 fields
    const ga4Fields = [];
    const gscFields = [];
    const adsFields = [];
    const gbpFields = [];
    const otherFields = [];

    allFields.forEach(field => {
      if (field.includes('session') || field.includes('user') || field.includes('traffic_') ||
          field.includes('bounce') || field.includes('duration') || field.includes('pages') ||
          field.includes('blog_')) {
        ga4Fields.push(field);
      } else if (field.includes('seo_') || field.includes('keyword') || field.includes('rank') || field === 'top_keywords' || field === 'google_rank') {
        gscFields.push(field);
      } else if (field.includes('ads_') || field.includes('ad_') || field.includes('cpc') || field.includes('ctr') ||
                 field === 'ad_spend') {
        adsFields.push(field);
      } else if (field.includes('gbp_')) {
        gbpFields.push(field);
      } else {
        otherFields.push(field);
      }
    });

    // Display GA4 fields
    console.log('📈 GA4 FIELDS (Google Analytics 4):');
    console.log('─'.repeat(70));
    ga4Fields.forEach((f, i) => {
      const val = row[f];
      let type = 'number';
      if (typeof val === 'string') type = 'text';
      else if (val === null) type = 'null';
      console.log(`${String(i + 1).padEnd(3)} ${f.padEnd(35)} = ${val !== null ? (typeof val === 'string' && val.length > 40 ? val.substring(0, 40) + '...' : val) : 'NULL'} (${type})`);
    });

    // Display GSC fields
    console.log('\n📋 GSC FIELDS (Google Search Console):');
    console.log('─'.repeat(70));
    gscFields.forEach((f, i) => {
      const val = row[f];
      let type = 'number';
      if (typeof val === 'string') type = 'text';
      else if (val === null) type = 'null';
      console.log(`${String(i + 1).padEnd(3)} ${f.padEnd(35)} = ${val !== null ? (typeof val === 'string' && val.length > 40 ? val.substring(0, 40) + '...' : val) : 'NULL'} (${type})`);
    });

    // Display Ads fields
    console.log('\n💰 ADS FIELDS (Google Ads):');
    console.log('─'.repeat(70));
    adsFields.forEach((f, i) => {
      const val = row[f];
      let type = 'number';
      if (typeof val === 'string') type = 'text';
      else if (val === null) type = 'null';
      console.log(`${String(i + 1).padEnd(3)} ${f.padEnd(35)} = ${val !== null ? val : 'NULL'} (${type})`);
    });

    // Display GBP fields
    console.log('\n🏪 GBP FIELDS (Google Business Profile):');
    console.log('─'.repeat(70));
    gbpFields.forEach((f, i) => {
      const val = row[f];
      let type = 'number';
      if (typeof val === 'string') type = 'text';
      else if (val === null) type = 'null';
      console.log(`${String(i + 1).padEnd(3)} ${f.padEnd(35)} = ${val !== null ? val : 'NULL'} (${type})`);
    });

    // Display other fields
    console.log('\n🔧 OTHER FIELDS:');
    console.log('─'.repeat(70));
    otherFields.forEach((f, i) => {
      const val = row[f];
      let type = 'number';
      if (typeof val === 'string') type = 'text';
      else if (val === null) type = 'null';
      console.log(`${String(i + 1).padEnd(3)} ${f.padEnd(35)} = ${val !== null ? (typeof val === 'string' && val.length > 40 ? val.substring(0, 40) + '...' : val) : 'NULL'} (${type})`);
    });

    // Summary
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 SUMMARY                                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`GA4 METRICS: ${ga4Fields.length} fields`);
    console.log(`GSC METRICS: ${gscFields.length} fields`);
    console.log(`ADS METRICS: ${adsFields.length} fields`);
    console.log(`GBP METRICS: ${gbpFields.length} fields`);
    console.log(`OTHER: ${otherFields.length} fields`);
    console.log(`TOTAL: ${allFields.length} fields\n`);

    // Recommendations
    console.log('💡 CURRENTLY USED IN SEO PAGE:');
    console.log('─'.repeat(70));
    console.log(`GA4: sessions, users, traffic_organic, traffic_paid, traffic_direct,`);
    console.log(`     traffic_referral, traffic_ai, branded_traffic, non_branded_traffic`);
    console.log(`GSC: seo_impressions, seo_clicks, seo_ctr, google_rank, top_keywords,`);
    console.log(`     keywords_improved, keywords_declined`);
    console.log(`\n✨ AVAILABLE GA4 METRICS (not yet used):`);
    console.log('─'.repeat(70));
    const unusedGA4 = ga4Fields.filter(f =>
      !['sessions', 'users', 'traffic_organic', 'traffic_paid', 'traffic_direct',
        'traffic_referral', 'traffic_ai', 'branded_traffic', 'non_branded_traffic'].includes(f)
    );
    unusedGA4.forEach(f => {
      const val = row[f];
      console.log(`  • ${f.padEnd(35)} = ${val}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllGA4Metrics();
