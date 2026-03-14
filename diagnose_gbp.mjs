import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials (already in debug files)
const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function diagnose() {
  console.log('🔍 GBP API Diagnostic Report\n');
  console.log('=' .repeat(50));

  // 1. Check if token exists
  console.log('\n1️⃣  OAuth Token Status:');
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from('system_settings')
    .select('*')
    .eq('key', 'gbp_agency_master')
    .single();

  if (tokenError || !tokenData) {
    console.log('   ❌ NO TOKEN FOUND in system_settings');
    console.log('   💡 Fix: Run OAuth setup at /admin/google-business-setup');
    return;
  }

  const token = JSON.parse(tokenData.value);
  const now = Date.now();
  const isExpired = token.expiry_date < now;
  const expiresIn = Math.ceil((token.expiry_date - now) / 1000 / 60);

  console.log(`   ✅ Token found`);
  console.log(`   📧 Email: ${token.email}`);
  console.log(`   ⏰ Status: ${isExpired ? '❌ EXPIRED' : `✅ Valid (${expiresIn}m left)`}`);
  console.log(`   🔄 Refresh token: ${token.refresh_token ? '✅ Yes' : '❌ No'}`);

  // 2. Check GBP locations
  console.log('\n2️⃣  GBP Locations:');
  const { data: locations, error: locError } = await supabaseAdmin
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name, is_active')
    .eq('is_active', true);

  if (locError) {
    console.log(`   ❌ Error fetching locations: ${locError.message}`);
    return;
  }

  const validLocs = (locations || []).filter(l => l.gbp_location_id);
  console.log(`   ✅ Found ${validLocs.length} active locations with IDs`);
  if (validLocs.length === 0) {
    console.log('   💡 No active GBP locations configured');
  }

  // 3. Test API call with sample location
  if (validLocs.length > 0 && !isExpired) {
    console.log('\n3️⃣  Testing GBP API (sample location):');
    const testLoc = validLocs[0];

    let locationId = testLoc.gbp_location_id;
    if (!locationId.startsWith('locations/')) {
      locationId = `locations/${locationId}`;
    }

    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1);
    const yesterday = testDate.toISOString().split('T')[0];

    try {
      const url = new URL(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
      );
      const [year, month, day] = yesterday.split('-').map(Number);
      url.searchParams.set('dailyMetric', 'CALL_CLICKS');
      url.searchParams.set('dailyRange.start_date.year', String(year));
      url.searchParams.set('dailyRange.start_date.month', String(month));
      url.searchParams.set('dailyRange.start_date.day', String(day));
      url.searchParams.set('dailyRange.end_date.year', String(year));
      url.searchParams.set('dailyRange.end_date.month', String(month));
      url.searchParams.set('dailyRange.end_date.day', String(day));

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum, d) => sum + (parseInt(d.value || '0') || 0), 0);
        console.log(`   ✅ API call successful`);
        console.log(`   📊 Sample: ${testLoc.location_name} on ${yesterday}: ${value} calls`);
      } else {
        console.log(`   ❌ API returned ${response.status}`);
        const text = await response.text();
        console.log(`   📝 Response: ${text.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ❌ API call failed: ${e.message}`);
    }
  }

  // 4. Check recent syncs
  console.log('\n4️⃣  Recent GBP Data (last 5 days):');
  const { data: recentData, error: recentError } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('date, COUNT(*)')
    .gte('date', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .group('date')
    .order('date', { ascending: false })
    .limit(5);

  if (recentError) {
    console.log(`   ⚠️  Error checking recent data: ${recentError.message}`);
  } else if (recentData && recentData.length > 0) {
    console.log(`   ✅ Found recent data:`);
    recentData.forEach(r => {
      console.log(`      ${r.date}: ${r.COUNT} location records`);
    });
  } else {
    console.log(`   ⚠️  No recent data in last 5 days`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Recommendation:');
  if (isExpired && token.refresh_token) {
    console.log('✅ Token expired but can auto-refresh - next sync will refresh');
  } else if (isExpired) {
    console.log('❌ Token expired - need to re-authenticate at /admin/google-business-setup');
  } else if (!validLocs.length) {
    console.log('⚠️  No GBP locations configured - add locations first');
  } else {
    console.log('✅ All systems operational - manual sync should work');
  }
}

diagnose().catch(console.error);
