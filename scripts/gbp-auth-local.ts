/**
 * GBP Local Auth Script
 * Run locally to get OAuth token and save to Supabase
 * Usage: npx tsx scripts/gbp-auth-local.ts
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as http from 'http';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/api/auth/callback/gbp`;

async function main() {
  console.log('\n🔐 GBP OAuth Local Auth Tool\n');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });

  // Start local server to capture the code
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>❌ Auth failed: ' + error + '</h2><p>You can close this tab.</p>');
        server.close();
        reject(new Error('OAuth error: ' + error));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>✅ Auth successful!</h2><p>You can close this tab and return to the terminal.</p>');
        server.close();
        resolve(code);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`📋 Open this URL in your browser:\n`);
      console.log(authUrl);
      console.log('\n⏳ Waiting for Google to redirect...\n');
    });

    server.on('error', reject);
  });

  console.log('✅ Got authorization code');
  console.log('⏳ Exchanging for tokens...');

  const { tokens } = await oauth2Client.getToken(code);

  // Get user email
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  console.log(`✅ Authenticated as: ${userInfo.email}`);

  if (!tokens.refresh_token) {
    console.error('❌ No refresh token received. Try revoking access at https://myaccount.google.com/permissions and run again.');
    return;
  }

  // Save to Supabase
  const tokenData = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date!,
    email: userInfo.email || undefined,
  };

  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'gbp_agency_master',
      value: JSON.stringify(tokenData),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    console.error('❌ Failed to save to Supabase:', error.message);
    return;
  }

  console.log('\n✅ Token saved to Supabase!');
  console.log(`   Email: ${userInfo.email}`);
  console.log(`   Expires: ${new Date(tokens.expiry_date!).toLocaleString()}`);
  console.log('\n🎉 GBP cron will now work automatically!\n');
}

main().catch(console.error);
