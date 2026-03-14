import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function diagnose() {
  console.log('🔍 CRON JOB DIAGNOSTICS\n');
  
  // 1. Check token
  console.log('1️⃣  GBP Token Status:');
  const { data: token } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  if (!token) {
    console.log('   ❌ NO TOKEN - cronjob will fail!');
  } else {
    const t = JSON.parse(token.value);
    const isExpired = t.expiry_date < Date.now() + 5 * 60 * 1000;
    console.log(`   ✅ Token exists`);
    console.log(`   Expired: ${isExpired ? '🔴 YES' : '🟢 NO'}`);
    console.log(`   Has refresh_token: ${t.refresh_token ? '✅' : '❌'}`);
  }

  // 2. Check GBP locations
  console.log('\n2️⃣  GBP Locations:');
  const { data: locs } = await supabaseAdmin
    .from('gbp_locations')
    .select('id, location_name, is_active, gbp_location_id')
    .eq('is_active', true);

  console.log(`   Active: ${locs?.length || 0}/16`);
  const missing = (locs || []).filter(l => !l.gbp_location_id).length;
  if (missing > 0) {
    console.log(`   ⚠️  ${missing} locations missing gbp_location_id`);
  }

  // 3. Check recent syncs
  console.log('\n3️⃣  Recent GBP Data:');
  const { data: recent } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('date, location_id')
    .order('date', { ascending: false })
    .limit(5);

  if (recent?.length > 0) {
    console.log(`   Latest: ${recent[0].date}`);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const hasYesterday = recent.some(r => r.date === yesterdayStr);
    console.log(`   Yesterday (${yesterdayStr}): ${hasYesterday ? '✅' : '❌'}`);
  }

  // 4. Check Vercel settings
  console.log('\n4️⃣  Vercel Cron Setup:');
  console.log('   Check vercel.json for cron schedule...');
  
  console.log('\n📋 POTENTIAL ISSUES:');
  console.log('   • Token expired but no refresh_token?');
  console.log('   • Missing gbp_location_id on locations?');
  console.log('   • CRON_SECRET env var not set?');
  console.log('   • Batch size too large (rate limiting)?');
  console.log('   • fetchGBPDay throwing silently?');
}

diagnose();
