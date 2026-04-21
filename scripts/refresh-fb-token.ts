import { supabaseAdmin } from '../src/lib/supabase';
import { sendTelegramMessage } from '../src/lib/telegram';
import * as fs from 'fs';

async function main() {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const currentToken = process.env.FB_ADS_ACCESS_TOKEN;

  if (!appId || !appSecret || !currentToken) {
    console.error('[refresh-fb-token] Missing FB_APP_ID, FB_APP_SECRET, or FB_ADS_ACCESS_TOKEN');
    process.exit(1);
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${currentToken}`
    );

    if (!res.ok) throw new Error(`FB token exchange failed: ${await res.text()}`);

    const data = await res.json();
    if (data.error) throw new Error(`FB API error: ${data.error.message}`);

    const newToken: string = data.access_token;
    const expiresInDays = Math.round((data.expires_in || 5184000) / 86400);
    if (!newToken) throw new Error('No access_token returned by FB');

    console.log(`[refresh-fb-token] Token refreshed. Expires in ${expiresInDays} days.`);

    // Save to Supabase (backup store — sync-fb-ads reads this as fallback)
    await supabaseAdmin
      .from('system_settings')
      .upsert(
        { key: 'fb_ads_access_token', value: newToken, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    // Write new token to file so the workflow step can update GitHub Secret
    fs.writeFileSync('/tmp/fb_new_token.txt', newToken, 'utf8');
    console.log('[refresh-fb-token] New token written to /tmp/fb_new_token.txt for GitHub Secret update.');

    await sendTelegramMessage(
      `🔄 <b>FB Ads Token Refreshed</b>\n\n` +
      `✅ Token renewed automatically\n` +
      `⏳ Expires in: ${expiresInDays} days\n` +
      `🔒 GitHub Secret will be auto-updated`
    ).catch(() => {});

  } catch (err: any) {
    console.error('[refresh-fb-token] Failed:', err.message);
    await sendTelegramMessage(`❌ <b>FB Token Refresh FAILED</b>\n\n${err.message}`).catch(() => {});
    process.exit(1);
  }
}

main();
