const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scanAllTables() {
  try {
    console.log('🔍 SCANNING ALL TABLES IN SUPABASE');
    console.log('='.repeat(70));

    // List of known tables to check
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
      'ads_correlation_patterns',
      'lead_sources',
      'conversion_tracking',
      'daily_metrics',
      'metrics_daily'
    ];

    let foundTables = [];

    for (const tableName of tableNames) {
      try {
        const { data, error, status } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (!error && (status === 200 || data)) {
          foundTables.push({ name: tableName, exists: true });
          console.log(`✅ ${tableName}`);
        }
      } catch (e) {
        // Table doesn't exist or no access
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Found tables: ${foundTables.length}`);
    console.log('\nFound tables:');
    foundTables.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

scanAllTables();
