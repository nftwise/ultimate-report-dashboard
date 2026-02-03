#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tupedninjtaarmdwppgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const supabaseAdmin = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const supabase = createClient(supabaseUrl, supabaseAdmin);

// Helper to get table info via SQL
async function executeSQL(query) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql: query }).catch(() => null);
    if (error && error !== null) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

// Get column info from information_schema
async function getTableColumns(tableName) {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', tableName)
      .eq('table_schema', 'public');

    if (error) {
      console.log(`Note: Could not fetch column info for ${tableName} via information_schema`);
      return null;
    }
    return data;
  } catch (err) {
    console.log(`Note: information_schema access issue for ${tableName}`);
    return null;
  }
}

async function main() {
  try {
    console.log('=' .repeat(100));
    console.log('SUPABASE DATABASE COMPREHENSIVE ANALYSIS');
    console.log('=' .repeat(100));
    console.log('');

    // ============================================================================
    // 1. ANALYZE client_metrics_summary TABLE
    // ============================================================================
    console.log('1. CLIENT_METRICS_SUMMARY TABLE ANALYSIS');
    console.log('-' .repeat(100));
    console.log('');

    try {
      // Get all records with sample data
      const { data: allMetrics, error: metricsError } = await supabase
        .from('client_metrics_summary')
        .select('*')
        .limit(5);

      if (metricsError) {
        console.error('Error fetching client_metrics_summary:', metricsError);
      } else if (allMetrics && allMetrics.length > 0) {
        const sample = allMetrics[0];
        console.log('Available Columns:');
        console.log('');
        const columns = Object.keys(sample).sort();

        // Create table format
        console.log('| Column Name | Data Type | Sample Value | Notes |');
        console.log('|---|---|---|---|');

        columns.forEach(col => {
          const value = sample[col];
          let dataType = typeof value;
          if (value === null) dataType = 'NULL';
          else if (Array.isArray(value)) dataType = 'ARRAY';
          else if (dataType === 'object') dataType = 'OBJECT';

          const sampleVal = value === null ? 'NULL' : JSON.stringify(value).substring(0, 50);
          console.log(`| ${col} | ${dataType} | ${sampleVal} | |`);
        });

        console.log('');
        console.log(`Total Records in Table: (checking...)`);

        // Get count and check data distribution
        const { data: countCheck, error: countError } = await supabase
          .from('client_metrics_summary')
          .select('*', { count: 'exact' });

        if (!countError) {
          console.log(`Total Records: ${countCheck.length}`);

          // Analyze data distribution
          console.log('');
          console.log('Data Distribution Analysis:');
          console.log('');

          const nonZeroMetrics = {};
          const metrics = ['gbp_calls', 'google_ads_conversions', 'ads_impressions', 'ads_clicks', 'gbp_phone_impression_clicks', 'gbp_phone_impression_clicks_percent'];

          metrics.forEach(metric => {
            const nonZeroCount = countCheck.filter(r => r[metric] && r[metric] > 0).length;
            const zeroCount = countCheck.length - nonZeroCount;
            const percent = ((nonZeroCount / countCheck.length) * 100).toFixed(1);
            console.log(`${metric}: ${nonZeroCount} non-zero (${percent}%) / ${zeroCount} zero`);
          });
        }
      } else {
        console.log('No data found in client_metrics_summary table');
      }
    } catch (err) {
      console.error('Error analyzing client_metrics_summary:', err.message);
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 2. ANALYZE gbp_location_daily_metrics TABLE
    // ============================================================================
    console.log('2. GBP_LOCATION_DAILY_METRICS TABLE ANALYSIS');
    console.log('-' .repeat(100));
    console.log('');

    try {
      const { data: gbpMetrics, error: gbpError } = await supabase
        .from('gbp_location_daily_metrics')
        .select('*')
        .limit(5);

      if (gbpError) {
        if (gbpError.code === 'PGRST116') {
          console.log('Table not found or no access');
        } else {
          console.error('Error fetching gbp_location_daily_metrics:', gbpError);
        }
      } else if (gbpMetrics && gbpMetrics.length > 0) {
        const sample = gbpMetrics[0];
        console.log('Available Columns:');
        console.log('');
        const columns = Object.keys(sample).sort();

        console.log('| Column Name | Data Type | Sample Value | Notes |');
        console.log('|---|---|---|---|');

        columns.forEach(col => {
          const value = sample[col];
          let dataType = typeof value;
          if (value === null) dataType = 'NULL';
          else if (Array.isArray(value)) dataType = 'ARRAY';
          else if (dataType === 'object') dataType = 'OBJECT';

          const sampleVal = value === null ? 'NULL' : JSON.stringify(value).substring(0, 50);
          console.log(`| ${col} | ${dataType} | ${sampleVal} | |`);
        });

        console.log('');
        const { data: gbpCountCheck } = await supabase
          .from('gbp_location_daily_metrics')
          .select('*', { count: 'exact' });

        if (gbpCountCheck) {
          console.log(`Total Records: ${gbpCountCheck.length}`);

          // Analyze data distribution
          console.log('');
          console.log('Data Distribution Analysis:');
          console.log('');

          const possibleMetrics = Object.keys(gbpMetrics[0]).filter(k =>
            typeof gbpMetrics[0][k] === 'number' && !k.includes('id') && !k.includes('date')
          );

          possibleMetrics.slice(0, 10).forEach(metric => {
            const nonZeroCount = gbpCountCheck.filter(r => r[metric] && r[metric] > 0).length;
            const zeroCount = gbpCountCheck.length - nonZeroCount;
            const percent = ((nonZeroCount / gbpCountCheck.length) * 100).toFixed(1);
            console.log(`${metric}: ${nonZeroCount} non-zero (${percent}%) / ${zeroCount} zero`);
          });
        }
      } else {
        console.log('No data found in gbp_location_daily_metrics table');
      }
    } catch (err) {
      console.error('Error analyzing gbp_location_daily_metrics:', err.message);
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 3. CHECK FOR GBP-RELATED TABLES
    // ============================================================================
    console.log('3. CHECKING FOR GBP-RELATED TABLES');
    console.log('-' .repeat(100));
    console.log('');

    const tableNames = [
      'gbp_local_service_ads_metrics',
      'gbp_revenue',
      'gbp_calls_data',
      'gbp_insights',
      'gbp_location_metrics',
      'gbp_phone_leads',
      'gbp_message_leads',
      'gbp_post_metrics',
      'gbp_reviews',
      'gbp_photos',
      'gbp_business_hours',
      'google_ads_metrics',
      'google_ads_conversions',
      'metrics_summary',
      'daily_metrics'
    ];

    console.log('Attempting to access the following GBP-related tables:');
    console.log('');

    const accessibleTables = [];
    const inaccessibleTables = [];

    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1);

        if (error) {
          if (error.code !== 'PGRST116') {
            inaccessibleTables.push({ name: tableName, error: error.message });
          }
        } else if (data !== null) {
          accessibleTables.push(tableName);
        }
      } catch (err) {
        inaccessibleTables.push({ name: tableName, error: err.message });
      }
    }

    if (accessibleTables.length > 0) {
      console.log('✓ Accessible Tables:');
      accessibleTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('No GBP-related tables found.');
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 4. LATEST DATA FROM BOTH TABLES FOR FIRST AVAILABLE CLIENT
    // ============================================================================
    console.log('4. LATEST DATA SAMPLE - LAST 5 DAYS');
    console.log('-' .repeat(100));
    console.log('');

    try {
      // Get first client
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .limit(1);

      if (clients && clients.length > 0) {
        const clientId = clients[0].id;
        const clientName = clients[0].name;

        console.log(`Client: ${clientName} (ID: ${clientId})`);
        console.log('');
        console.log('Latest 5 days from client_metrics_summary:');
        console.log('');

        const { data: latest5 } = await supabase
          .from('client_metrics_summary')
          .select('*')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(5);

        if (latest5 && latest5.length > 0) {
          console.log('| Date | GBP Calls | Ads Conv | Ads Imp | Ads Clicks |');
          console.log('|---|---|---|---|---|');
          latest5.forEach(row => {
            const date = row.date ? new Date(row.date).toISOString().split('T')[0] : 'N/A';
            console.log(`| ${date} | ${row.gbp_calls || 0} | ${row.google_ads_conversions || 0} | ${row.ads_impressions || 0} | ${row.ads_clicks || 0} |`);
          });
        } else {
          console.log('No data found for this client');
        }

        console.log('');
        console.log('Latest 5 days from gbp_location_daily_metrics:');
        console.log('');

        try {
          const { data: gbpLatest5 } = await supabase
            .from('gbp_location_daily_metrics')
            .select('*')
            .eq('client_id', clientId)
            .order('date', { ascending: false })
            .limit(5);

          if (gbpLatest5 && gbpLatest5.length > 0) {
            const cols = Object.keys(gbpLatest5[0]).filter(c => c !== 'id' && c !== 'created_at').slice(0, 8);
            const header = cols.map(c => c.substring(0, 12)).join(' | ');
            console.log(`| ${header} |`);
            console.log('|' + Array(cols.length).fill('---').join('|') + '|');

            gbpLatest5.forEach(row => {
              const vals = cols.map(c => (row[c] || '0')).join(' | ');
              console.log(`| ${vals} |`);
            });
          } else {
            console.log('No data found in gbp_location_daily_metrics for this client');
          }
        } catch (err) {
          console.log('gbp_location_daily_metrics not accessible or no data');
        }
      }
    } catch (err) {
      console.error('Error fetching latest data:', err.message);
    }

    console.log('');
    console.log('=' .repeat(100));
    console.log('ANALYSIS COMPLETE');
    console.log('=' .repeat(100));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
