import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://tupedninjtaarmdwppgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function importToken() {
  console.log('🔄 Importing GBP token from previous project...\n');

  // Read token from previous project
  const tokenPath = path.join(
    process.cwd(),
    '../ultimate-report-dashboard-1/.oauth-tokens/agency-master-gbp.json'
  );

  if (!fs.existsSync(tokenPath)) {
    console.error('❌ Token file not found at:', tokenPath);
    process.exit(1);
  }

  const rawToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  console.log('✅ Token file found');
  console.log(`   Refresh token: ${rawToken.refresh_token.substring(0, 50)}...`);
  console.log(`   Access token: ${rawToken.access_token.substring(0, 50)}...`);

  // Format token for GBPTokenManager
  // It expects: access_token, refresh_token, expiry_date (number), email
  const token = {
    access_token: rawToken.access_token,
    refresh_token: rawToken.refresh_token,
    expiry_date: rawToken.token_expiry || Date.now() + 3600 * 1000, // 1 hour from now if missing
    email: 'agency@example.com' // We'll update this when we know the real email
  };

  console.log(`\n⏰ Token expiry: ${new Date(token.expiry_date).toISOString()}`);

  // Save to Supabase system_settings
  console.log('\n📤 Saving to Supabase system_settings...');

  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert({
      key: 'gbp_agency_master',
      value: JSON.stringify(token),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    console.error('❌ Failed to save token:', error.message);
    process.exit(1);
  }

  console.log('✅ Token saved successfully!');

  // Verify it was saved
  const { data, error: verifyError } = await supabaseAdmin
    .from('system_settings')
    .select('*')
    .eq('key', 'gbp_agency_master')
    .single();

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    process.exit(1);
  }

  const savedToken = JSON.parse(data.value);
  console.log('\n✅ Verification successful:');
  console.log(`   Key: ${data.key}`);
  console.log(`   Access token (first 50): ${savedToken.access_token.substring(0, 50)}...`);
  console.log(`   Refresh token exists: ${savedToken.refresh_token ? '✅' : '❌'}`);
  console.log(`   Expires: ${new Date(savedToken.expiry_date).toISOString()}`);

  console.log('\n🎉 GBP token is ready! You can now sync data.');
  console.log('\nNext steps:');
  console.log('1. Run GBP sync: curl http://localhost:3000/api/cron/sync-gbp');
  console.log('2. Or wait for scheduled cron job at 10:12 UTC daily');
}

importToken().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
