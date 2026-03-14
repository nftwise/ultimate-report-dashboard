#!/usr/bin/env node

/**
 * GBP API Verification Script
 * Directly queries Google Business Profile API for CorePosture
 * Usage: node verify-gbp-api.js
 */

const https = require('https');

// Configuration
const CLIENT_SLUG = 'coreposture';
const DATE_FROM = '2026-02-01';
const DATE_TO = '2026-02-28';

// You'll need to set these env vars or hardcode them
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Supabase query function
async function fetchFromSupabase(table, select, filters = {}) {
  return new Promise((resolve, reject) => {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    for (const [key, value] of Object.entries(filters)) {
      url += `&${key}=eq.${value}`;
    }

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

// Main function
async function main() {
  try {
    console.log('🔍 Verifying GBP API for CorePosture...\n');

    // Step 1: Get client
    console.log('📌 Step 1: Fetching client "coreposture"...');
    const clients = await fetchFromSupabase('clients', 'id,name,slug', { slug: CLIENT_SLUG });
    if (!clients || clients.length === 0) {
      console.error('❌ Client not found');
      process.exit(1);
    }
    const client = clients[0];
    console.log(`✅ Found: ${client.name} (ID: ${client.id})\n`);

    // Step 2: Get GBP location
    console.log('📌 Step 2: Fetching GBP location...');
    const locations = await fetchFromSupabase(
      'gbp_locations',
      'id,gbp_location_id,location_name,client_id',
      { client_id: client.id }
    );
    if (!locations || locations.length === 0) {
      console.error('❌ No GBP location found');
      process.exit(1);
    }
    const location = locations[0];
    console.log(`✅ Found: ${location.location_name} (ID: ${location.gbp_location_id})\n`);

    // Step 3: Get GBP OAuth token
    console.log('📌 Step 3: Fetching GBP OAuth token...');
    const settings = await fetchFromSupabase(
      'system_settings',
      'name,value',
      { name: 'gbp_refresh_token' }
    );
    if (!settings || settings.length === 0) {
      console.error('❌ No GBP refresh token found in system_settings');
      process.exit(1);
    }
    const refreshToken = settings[0].value;
    console.log(`✅ Found refresh token\n`);

    // Step 4: Get access token (mock - you'd need to implement OAuth refresh)
    console.log('📌 Step 4: Would call Google OAuth to refresh token...');
    console.log('⚠️  This script cannot refresh the token automatically');
    console.log('    You need to manually set GOOGLE_GBP_ACCESS_TOKEN env var\n');

    // Step 5: Query database for actual stored values
    console.log('📌 Step 5: Fetching stored GBP metrics for February...');
    const dbMetrics = await fetchFromSupabase(
      'gbp_location_daily_metrics',
      'date,phone_calls,website_clicks,direction_requests,views',
      { location_id: location.id }
    );

    const febMetrics = dbMetrics.filter(m => m.date >= DATE_FROM && m.date <= DATE_TO);

    if (febMetrics.length === 0) {
      console.error('❌ No metrics found for February');
    } else {
      console.log(`✅ Found ${febMetrics.length} days of data\n`);

      const totalCalls = febMetrics.reduce((sum, m) => sum + (m.phone_calls || 0), 0);
      const totalWebsite = febMetrics.reduce((sum, m) => sum + (m.website_clicks || 0), 0);
      const totalDirections = febMetrics.reduce((sum, m) => sum + (m.direction_requests || 0), 0);
      const totalViews = febMetrics.reduce((sum, m) => sum + (m.views || 0), 0);

      console.log('📊 Summary for February 2026:');
      console.log(`   Phone Calls (CALL_CLICKS):    ${totalCalls}`);
      console.log(`   Website Clicks:               ${totalWebsite}`);
      console.log(`   Direction Requests:           ${totalDirections}`);
      console.log(`   Profile Views:                ${totalViews}\n`);

      console.log('📈 Daily breakdown:');
      febMetrics.forEach(m => {
        console.log(`   ${m.date}: ${m.phone_calls} calls`);
      });
    }

    // Step 6: Check client_metrics_summary for comparison
    console.log('\n📌 Step 6: Checking client_metrics_summary (aggregated)...');
    const summaryMetrics = await fetchFromSupabase(
      'client_metrics_summary',
      'date,gbp_calls',
      { client_id: client.id }
    );

    const febSummary = summaryMetrics.filter(m => m.date >= DATE_FROM && m.date <= DATE_TO);
    const summaryTotal = febSummary.reduce((sum, m) => sum + (m.gbp_calls || 0), 0);
    console.log(`✅ Summary table GBP calls for February: ${summaryTotal}\n`);

    // Conclusion
    console.log('🎯 CONCLUSION:');
    console.log(`   Database value (from API):  ${totalCalls} calls`);
    console.log(`   GBP Dashboard shows:        33 calls (from your observation)`);
    console.log(`   Discrepancy:                ${33 - totalCalls} calls (${Math.round((33 - totalCalls) / 33 * 100)}%)`);
    console.log('\n   → This confirms if the API returned 22 or a different number');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
