#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const CLIENT_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';

async function querySupabase(table, select, clientId, dateFrom, dateTo) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&client_id=eq.${clientId}&date=gte.${dateFrom}&date=lte.${dateTo}&order=date`;

    const options = {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('📋 Checking client_metrics_summary (aggregated table) for CorePosture\n');

    const summaryData = await querySupabase(
      'client_metrics_summary',
      'date,gbp_calls,gbp_website_clicks,gbp_directions,gbp_profile_views',
      CLIENT_ID,
      '2026-02-01',
      '2026-02-28'
    );

    if (!summaryData || summaryData.length === 0) {
      console.log('❌ No data in summary table\n');
      return;
    }

    const totalCalls = summaryData.reduce((sum, m) => sum + (m.gbp_calls || 0), 0);

    console.log(`✅ Found ${summaryData.length} days\n`);
    console.log('📊 TOTAL FROM client_metrics_summary:');
    console.log(`   GBP Calls: ${totalCalls}\n`);

    console.log('📈 Daily:');
    summaryData.forEach(m => {
      console.log(`   ${m.date}: ${m.gbp_calls} calls`);
    });

    console.log('\n🔄 COMPARISON:');
    console.log(`   gbp_location_daily_metrics:  27 calls`);
    console.log(`   client_metrics_summary:      ${totalCalls} calls`);
    console.log(`   GBP Dashboard:               33 calls`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
