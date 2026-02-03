#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tupedninjtaarmdwppgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const supabaseAdmin = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const supabase = createClient(supabaseUrl, supabaseAdmin);

async function main() {
  try {
    console.log('=' .repeat(120));
    console.log('DETAILED SUPABASE DATABASE ANALYSIS - WITH REAL DATA SAMPLES');
    console.log('=' .repeat(120));
    console.log('');

    // ============================================================================
    // 1. CLIENT_METRICS_SUMMARY - DETAILED COLUMN ANALYSIS
    // ============================================================================
    console.log('## 1. CLIENT_METRICS_SUMMARY TABLE');
    console.log('');
    console.log('### Column Definitions with Sample Data');
    console.log('');

    const { data: metricsData } = await supabase
      .from('client_metrics_summary')
      .select('*')
      .limit(3);

    if (metricsData && metricsData.length > 0) {
      const sample = metricsData[0];
      const columns = Object.keys(sample).sort();

      console.log('| # | Column Name | Data Type | Sample Value | Data Status |');
      console.log('|---|---|---|---|---|');

      let index = 1;
      columns.forEach(col => {
        const value = sample[col];
        let dataType = typeof value;
        let dataStatus = 'N/A';

        if (value === null || value === undefined) {
          dataType = 'NULL';
          dataStatus = 'Empty';
        } else if (Array.isArray(value)) {
          dataType = 'ARRAY';
          dataStatus = value.length === 0 ? 'Empty Array' : `Array[${value.length}]`;
        } else if (dataType === 'object') {
          dataType = 'OBJECT';
          dataStatus = 'Object';
        } else if (dataType === 'number') {
          dataStatus = value === 0 ? 'Zero' : 'Has Value';
        } else if (dataType === 'string') {
          dataStatus = value.length === 0 ? 'Empty String' : 'Has Value';
        }

        let sampleVal = value;
        if (Array.isArray(value)) {
          sampleVal = JSON.stringify(value).substring(0, 40);
        } else if (typeof value === 'object' && value !== null) {
          sampleVal = JSON.stringify(value).substring(0, 40);
        } else if (typeof value === 'string') {
          sampleVal = value.substring(0, 40);
        }

        console.log(`| ${index} | ${col} | ${dataType} | ${sampleVal} | ${dataStatus} |`);
        index++;
      });

      console.log('');
      console.log('### Data Distribution Summary');
      console.log('');

      // Get comprehensive metrics
      const { data: allRecords } = await supabase
        .from('client_metrics_summary')
        .select('*');

      const keyMetrics = [
        'gbp_calls',
        'gbp_directions',
        'gbp_website_clicks',
        'gbp_profile_views',
        'gbp_posts_views',
        'gbp_searches_direct',
        'gbp_searches_discovery',
        'google_ads_conversions',
        'ads_impressions',
        'ads_clicks',
        'ad_spend',
        'seo_impressions',
        'seo_clicks',
        'sessions'
      ];

      console.log('| Metric | Non-Zero Records | Zero Records | % with Data | Avg Value (non-zero) |');
      console.log('|---|---|---|---|---|');

      keyMetrics.forEach(metric => {
        const nonZero = allRecords.filter(r => r[metric] && r[metric] > 0);
        const zero = allRecords.length - nonZero.length;
        const percent = ((nonZero.length / allRecords.length) * 100).toFixed(1);
        const avgNonZero = nonZero.length > 0
          ? (nonZero.reduce((sum, r) => sum + (r[metric] || 0), 0) / nonZero.length).toFixed(2)
          : 'N/A';

        console.log(`| ${metric} | ${nonZero.length} | ${zero} | ${percent}% | ${avgNonZero} |`);
      });
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 2. GBP_LOCATION_DAILY_METRICS - DETAILED COLUMN ANALYSIS
    // ============================================================================
    console.log('## 2. GBP_LOCATION_DAILY_METRICS TABLE');
    console.log('');
    console.log('### Column Definitions with Sample Data');
    console.log('');

    try {
      const { data: gbpData } = await supabase
        .from('gbp_location_daily_metrics')
        .select('*')
        .limit(3);

      if (gbpData && gbpData.length > 0) {
        const sample = gbpData[0];
        const columns = Object.keys(sample).sort();

        console.log('| # | Column Name | Data Type | Sample Value | Data Status |');
        console.log('|---|---|---|---|---|');

        let index = 1;
        columns.forEach(col => {
          const value = sample[col];
          let dataType = typeof value;
          let dataStatus = 'N/A';

          if (value === null || value === undefined) {
            dataType = 'NULL';
            dataStatus = 'Empty';
          } else if (Array.isArray(value)) {
            dataType = 'ARRAY';
            dataStatus = value.length === 0 ? 'Empty Array' : `Array[${value.length}]`;
          } else if (dataType === 'object') {
            dataType = 'OBJECT';
            dataStatus = 'Object';
          } else if (dataType === 'number') {
            dataStatus = value === 0 ? 'Zero' : 'Has Value';
          } else if (dataType === 'string') {
            dataStatus = value.length === 0 ? 'Empty String' : 'Has Value';
          }

          let sampleVal = value;
          if (Array.isArray(value)) {
            sampleVal = JSON.stringify(value).substring(0, 40);
          } else if (typeof value === 'object' && value !== null) {
            sampleVal = JSON.stringify(value).substring(0, 40);
          } else if (typeof value === 'string') {
            sampleVal = value.substring(0, 40);
          }

          console.log(`| ${index} | ${col} | ${dataType} | ${sampleVal} | ${dataStatus} |`);
          index++;
        });

        console.log('');
        console.log('### Data Distribution Summary');
        console.log('');

        const { data: allGBPRecords } = await supabase
          .from('gbp_location_daily_metrics')
          .select('*');

        const gbpMetrics = [
          'views',
          'actions',
          'phone_calls',
          'direction_requests',
          'website_clicks',
          'total_reviews',
          'new_reviews_today',
          'average_rating',
          'posts_views',
          'posts_actions',
          'business_photo_views',
          'customer_photo_views'
        ];

        console.log('| Metric | Non-Zero Records | Zero Records | % with Data | Avg Value (non-zero) |');
        console.log('|---|---|---|---|---|');

        gbpMetrics.forEach(metric => {
          const nonZero = allGBPRecords.filter(r => r[metric] && r[metric] > 0);
          const zero = allGBPRecords.length - nonZero.length;
          const percent = ((nonZero.length / allGBPRecords.length) * 100).toFixed(1);
          const avgNonZero = nonZero.length > 0
            ? (nonZero.reduce((sum, r) => sum + (r[metric] || 0), 0) / nonZero.length).toFixed(2)
            : 'N/A';

          console.log(`| ${metric} | ${nonZero.length} | ${zero} | ${percent}% | ${avgNonZero} |`);
        });
      }
    } catch (err) {
      console.log('Note: gbp_location_daily_metrics table error - ' + err.message);
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 3. CLIENT DATA WITH BOTH METRICS
    // ============================================================================
    console.log('## 3. SAMPLE CLIENT DATA - LATEST 5 DAYS COMPARISON');
    console.log('');

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name');

    // Find a client with data in client_metrics_summary
    let targetClient = null;
    for (const client of clients) {
      const { data: clientMetrics } = await supabase
        .from('client_metrics_summary')
        .select('*')
        .eq('client_id', client.id)
        .limit(1);

      if (clientMetrics && clientMetrics.length > 0) {
        targetClient = client;
        break;
      }
    }

    if (targetClient) {
      console.log(`**Client:** ${targetClient.name} (ID: ${targetClient.id})`);
      console.log('');
      console.log('### Latest 5 Days - client_metrics_summary');
      console.log('');

      const { data: latestMetrics } = await supabase
        .from('client_metrics_summary')
        .select('date, gbp_calls, gbp_directions, gbp_website_clicks, gbp_profile_views, google_ads_conversions, ads_impressions, ads_clicks, ad_spend, sessions, seo_impressions')
        .eq('client_id', targetClient.id)
        .order('date', { ascending: false })
        .limit(5);

      if (latestMetrics && latestMetrics.length > 0) {
        console.log('| Date | GBP Calls | GBP Directions | GBP Web Clicks | Profile Views | Ads Conv | Ads Imp | Ads Clicks | Ad Spend | Sessions |');
        console.log('|---|---|---|---|---|---|---|---|---|---|');
        latestMetrics.forEach(row => {
          const date = row.date ? row.date : 'N/A';
          console.log(`| ${date} | ${row.gbp_calls || 0} | ${row.gbp_directions || 0} | ${row.gbp_website_clicks || 0} | ${row.gbp_profile_views || 0} | ${row.google_ads_conversions || 0} | ${row.ads_impressions || 0} | ${row.ads_clicks || 0} | ${row.ad_spend || 0} | ${row.sessions || 0} |`);
        });
      }

      console.log('');
      console.log('### Latest 5 Days - gbp_location_daily_metrics');
      console.log('');

      try {
        const { data: latestGBP } = await supabase
          .from('gbp_location_daily_metrics')
          .select('date, views, actions, phone_calls, direction_requests, website_clicks, total_reviews, average_rating')
          .eq('client_id', targetClient.id)
          .order('date', { ascending: false })
          .limit(5);

        if (latestGBP && latestGBP.length > 0) {
          console.log('| Date | Views | Actions | Phone Calls | Directions | Web Clicks | Total Reviews | Avg Rating |');
          console.log('|---|---|---|---|---|---|---|---|');
          latestGBP.forEach(row => {
            const date = row.date ? row.date : 'N/A';
            console.log(`| ${date} | ${row.views || 0} | ${row.actions || 0} | ${row.phone_calls || 0} | ${row.direction_requests || 0} | ${row.website_clicks || 0} | ${row.total_reviews || 0} | ${row.average_rating || 'N/A'} |`);
          });
        } else {
          console.log('No data found in gbp_location_daily_metrics for this client');
        }
      } catch (err) {
        console.log('Could not access gbp_location_daily_metrics for this client');
      }
    }

    console.log('');
    console.log('');

    // ============================================================================
    // 4. SUMMARY STATISTICS
    // ============================================================================
    console.log('## 4. DATABASE SUMMARY STATISTICS');
    console.log('');

    const { data: allMetrics } = await supabase
      .from('client_metrics_summary')
      .select('*', { count: 'exact' });

    const { data: allGBP } = await supabase
      .from('gbp_location_daily_metrics')
      .select('*', { count: 'exact' });

    console.log('| Metric | Value |');
    console.log('|---|---|');
    console.log(`| Total Records in client_metrics_summary | ${allMetrics.length} |`);
    console.log(`| Total Records in gbp_location_daily_metrics | ${allGBP.length} |`);
    console.log(`| Total Clients | ${clients.length} |`);

    // Get date ranges
    const metricsWithData = allMetrics.filter(m => m.gbp_calls > 0 || m.google_ads_conversions > 0 || m.ads_impressions > 0);
    if (metricsWithData.length > 0) {
      const dates = metricsWithData.map(m => new Date(m.date)).sort((a, b) => a - b);
      console.log(`| Earliest date in metrics | ${dates[0].toISOString().split('T')[0]} |`);
      console.log(`| Latest date in metrics | ${dates[dates.length - 1].toISOString().split('T')[0]} |`);
    }

    const gbpWithData = allGBP.filter(m => m.phone_calls > 0 || m.direction_requests > 0 || m.website_clicks > 0);
    if (gbpWithData.length > 0) {
      const gbpDates = gbpWithData.map(m => new Date(m.date)).sort((a, b) => a - b);
      console.log(`| Earliest date in GBP metrics | ${gbpDates[0].toISOString().split('T')[0]} |`);
      console.log(`| Latest date in GBP metrics | ${gbpDates[gbpDates.length - 1].toISOString().split('T')[0]} |`);
    }

    console.log('');
    console.log('=' .repeat(120));
    console.log('ANALYSIS COMPLETE');
    console.log('=' .repeat(120));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
