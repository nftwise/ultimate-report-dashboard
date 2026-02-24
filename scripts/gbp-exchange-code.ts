import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CODE = '4/0AfrIepCdQ2WSbOvh7kMEdoCShovSEF8S4_RcfbqyaC2qfVrzYso4z0KCjUP7li52zHxG2Q';
const REDIRECT_URI = 'http://localhost:3000/api/auth/callback/gbp';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI
  );

  console.log('Exchanging code for tokens...');
  const { tokens } = await oauth2Client.getToken(CODE);

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  console.log('Email:', data.email);
  console.log('Refresh token:', tokens.refresh_token ? 'OK' : 'MISSING - run again');

  if (!tokens.refresh_token) {
    console.log('No refresh token. Revoke access at https://myaccount.google.com/permissions then retry.');
    return;
  }

  const { error } = await supabase.from('system_settings').upsert({
    key: 'gbp_agency_master',
    value: JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      email: data.email,
    }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase error:', error.message);
    return;
  }

  console.log('Token saved to Supabase!');
}

main().catch(console.error);
