const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEventFields() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         🔍 CHECK ALL EVENT-RELATED TABLES & FIELDS               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get a sample client
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

    // Check all tables
    const tables = [
      'client_metrics_summary',
      'gsc_queries',
      'gsc_pages',
      'ads_ad_group_metrics',
      'campaign_search_terms',
      'google_ads_call_metrics',
      'gbp_metrics',
      'gbp_reviews',
      'gsc_keywords_daily',
      'gsc_top_keywords',
      'events',
      'ga_events',
      'custom_events'
    ];

    for (const table of tables) {
      console.log(`\n📋 TABLE: ${table.toUpperCase()}`);
      console.log('─'.repeat(70));

      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('client_id', client.id)
          .limit(1);

        if (error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          continue;
        }

        if (!data || data.length === 0) {
          console.log(`  ⚠️  No data for this client`);
          continue;
        }

        const record = data[0];
        const fields = Object.keys(record);

        console.log(`  ✅ Found ${fields.length} fields:\n`);

        fields.forEach(field => {
          const value = record[field];
          let type = 'unknown';
          if (value === null) type = 'null';
          else if (typeof value === 'string') type = 'text';
          else if (typeof value === 'number') type = 'number';
          else if (typeof value === 'boolean') type = 'boolean';
          else if (Array.isArray(value)) type = 'array';
          else if (typeof value === 'object') type = 'object';

          const displayValue = typeof value === 'string' && value.length > 50
            ? value.substring(0, 47) + '...'
            : value;

          console.log(`     • ${field.padEnd(30)} (${type.padEnd(10)}) = ${displayValue}`);
        });

      } catch (err) {
        console.log(`  ❌ Table not found or inaccessible`);
      }
    }

    // ============================================
    // SEARCH FOR EVENT-RELATED FIELDS
    // ============================================
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              📊 EVENT-RELATED FIELDS SUMMARY                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('🎯 POTENTIAL EVENT/KEYWORD FIELDS TO USE:');
    console.log('─'.repeat(70));
    console.log('  ✓ gsc_queries - Contains keyword search queries');
    console.log('  ✓ gsc_pages - Contains page visit data');
    console.log('  ✓ gsc_keywords_daily - Daily keyword performance');
    console.log('  ✓ gsc_top_keywords - Top performing keywords list');
    console.log('  ✓ campaign_search_terms - Ads search terms');
    console.log('  ✓ google_ads_call_metrics - Phone call events from ads');
    console.log('  ✓ events - Custom tracking events');
    console.log('  ✓ ga_events - Google Analytics events');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkEventFields();
