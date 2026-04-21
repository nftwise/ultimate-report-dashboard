import { supabaseAdmin } from '../src/lib/supabase';
import { sendTelegramMessage } from '../src/lib/telegram';

async function main() {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const currentToken = process.env.FB_ADS_ACCESS_TOKEN;

  if (!appId || !appSecret || !currentToken) {
    console.error('[refresh-fb-token] Missing FB_APP_ID, FB_APP_SECRET, or FB_ADS_ACCESS_TOKEN');
    process.exit(1);
  }

  try {
    // Exchange current token for a new long-lived token (resets 60-day expiry)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${currentToken}`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`FB token exchange failed: ${err}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`FB API error: ${data.error.message}`);

    const newToken: string = data.access_token;
    const expiresIn: number = data.expires_in || 5184000; // ~60 days
    const expiresInDays = Math.round(expiresIn / 86400);

    if (!newToken) throw new Error('No access_token returned by FB');

    // Save to Supabase system_settings so scripts can read it on next run
    const { error: upsertErr } = await supabaseAdmin
      .from('system_settings')
      .upsert(
        { key: 'fb_ads_access_token', value: newToken, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (upsertErr) {
      console.warn('[refresh-fb-token] Supabase upsert warning:', upsertErr.message);
    }

    console.log(`[refresh-fb-token] Token refreshed. Expires in ${expiresInDays} days.`);
    console.log(`[refresh-fb-token] NEW TOKEN (update FB_ADS_ACCESS_TOKEN GitHub Secret):\n${newToken}`);

    await sendTelegramMessage(
      `🔄 <b>FB Ads Token Refreshed</b>\n\n` +
      `✅ New long-lived token generated\n` +
      `⏳ Expires in: ${expiresInDays} days\n\n` +
      `⚠️ <b>Action required:</b> Update <code>FB_ADS_ACCESS_TOKEN</code> secret in GitHub repo settings with the new token printed in Actions log.`
    ).catch(() => {});

  } catch (err: any) {
    console.error('[refresh-fb-token] Failed:', err.message);
    await sendTelegramMessage(
      `❌ <b>FB Token Refresh FAILED</b>\n\n${err.message}`
    ).catch(() => {});
    process.exit(1);
  }
}

main();
