import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function showAllTables() {
  console.log('\n' + '='.repeat(70));
  console.log('ALL TABLES IN DATABASE');
  console.log('='.repeat(70) + '\n');

  try {
    // Try to get table list from information_schema
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      console.log('Note: Cannot access information_schema directly');
      console.log('Trying alternative approach...\n');

      // Alternative: Try to infer tables from common names
      const commonTables = [
        'clients',
        'client_metrics_summary',
        'ga4_events',
        'service_configs',
        'locations',
        'gbp_metrics',
        'gbp_daily_metrics',
        'gbp_location_daily_metrics',
        'google_business_metrics',
        'audit_logs',
        'users',
        'accounts',
        'reports',
        'dashboards',
        'integrations',
        'webhooks',
        'analytics_events',
        'form_submissions',
        'leads',
        'conversions',
        'campaigns'
      ];

      console.log('Testing common table names:\n');
      let found = 0;

      for (const tableName of commonTables) {
        try {
          const { count, error: testError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!testError) {
            found++;
            console.log(`✅ ${found}. ${tableName} (${count} records)`);
          }
        } catch (e) {
          // Table doesn't exist
        }
      }

      console.log(`\nFound ${found} accessible tables\n`);
      return;
    }

    if (tables && tables.length > 0) {
      console.log('Public tables in database:\n');
      tables.forEach((table: any, index: number) => {
        console.log(`${index + 1}. ${table.table_name}`);
      });
      console.log(`\nTotal: ${tables.length} tables\n`);
    } else {
      console.log('No tables found\n');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }

  console.log('='.repeat(70) + '\n');
}

showAllTables().catch(console.error);
