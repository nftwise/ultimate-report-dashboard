#!/usr/bin/env node

/**
 * Query GBP metrics for CorePosture February 2026
 */

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
    console.log('🔍 Checking GBP data for CorePosture in February 2026\n');

    // Query gbp_location_daily_metrics
    console.log('📌 Querying gbp_location_daily_metrics...');
    const gbpData = await querySupabase(
      'gbp_location_daily_metrics',
      'date,phone_calls,website_clicks,direction_requests,views',
      CLIENT_ID,
      '2026-02-01',
      '2026-02-28'
    );

    if (!gbpData || gbpData.length === 0) {
      console.error('❌ No data found\n');
      process.exit(1);
    }

    console.log(`✅ Found ${gbpData.length} days of February data\n`);

    // Calculate totals
    const totalCalls = gbpData.reduce((sum, m) => sum + (m.phone_calls || 0), 0);
    const totalWebsite = gbpData.reduce((sum, m) => sum + (m.website_clicks || 0), 0);
    const totalDirections = gbpData.reduce((sum, m) => sum + (m.direction_requests || 0), 0);
    const totalViews = gbpData.reduce((sum, m) => sum + (m.views || 0), 0);

    console.log('📊 TOTAL FOR FEBRUARY 2026:');
    console.log(`   Phone Calls (CALL_CLICKS):  ${totalCalls}`);
    console.log(`   Website Clicks:             ${totalWebsite}`);
    console.log(`   Direction Requests:         ${totalDirections}`);
    console.log(`   Profile Views:              ${totalViews}\n`);

    console.log('📈 Daily breakdown:');
    gbpData.forEach(m => {
      console.log(`   ${m.date}: ${m.phone_calls} calls`);
    });

    console.log('\n🎯 ANALYSIS:');
    console.log(`   Database (API) value:       ${totalCalls} calls`);
    console.log(`   GBP Dashboard shows:        33 calls`);
    console.log(`   Difference:                 ${33 - totalCalls} calls (${Math.round((33 - totalCalls) / 33 * 100)}%)\n`);

    if (totalCalls === 22) {
      console.log('✅ CONFIRMED: Database has 22 calls (as expected)');
      console.log('   → This proves the 11-call discrepancy is a METRIC DIFFERENCE');
      console.log('   → CALL_CLICKS (button clicks) = 22');
      console.log('   → "Calls made from your Business Profile" (all initiations) = 33');
    } else if (totalCalls === 33) {
      console.log('❌ UNEXPECTED: Database has 33 calls (same as dashboard)');
      console.log('   → This suggests a different issue');
    } else {
      console.log(`⚠️  Database has ${totalCalls} calls (neither 22 nor 33)`);
      console.log('   → Need further investigation');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
