import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 60;

/**
 * GET /api/cron/refresh-fb-token
 *
 * Runs every 50 days — refreshes FB Page Access Token before it expires (60 days).
 * Updates Vercel env var automatically via Vercel API.
 *
 * GitHub Actions schedule: 0 10 1 * * (1st of every month, 10:00 UTC)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    const currentToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!appId || !appSecret || !currentToken) {
      throw new Error('Missing FB env vars: FB_APP_ID, FB_APP_SECRET, FB_PAGE_ACCESS_TOKEN');
    }

    // Exchange current token for a new long-lived token (reset 60-day clock)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${currentToken}`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`FB token refresh failed: ${err}`);
    }

    const data = await res.json();
    const newToken = data.access_token;
    const expiresIn = data.expires_in; // seconds (~5184000 = 60 days)

    if (!newToken) {
      throw new Error('No access_token in FB response');
    }

    // Update Vercel env var via Vercel API
    const vercelToken = process.env.VERCEL_ACCESS_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (vercelToken && vercelProjectId) {
      const teamQuery = vercelTeamId ? `?teamId=${vercelTeamId}` : '';

      // Delete old env var
      const listRes = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectId}/env${teamQuery}`,
        { headers: { Authorization: `Bearer ${vercelToken}` } }
      );
      const listData = await listRes.json();
      const envVar = (listData.envs || []).find(
        (e: any) => e.key === 'FB_PAGE_ACCESS_TOKEN' && e.target?.includes('production')
      );

      if (envVar?.id) {
        await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/env/${envVar.id}${teamQuery}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${vercelToken}` },
          }
        );
      }

      // Create new env var
      await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/env${teamQuery}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'FB_PAGE_ACCESS_TOKEN',
            value: newToken,
            type: 'encrypted',
            target: ['production'],
          }),
        }
      );

      console.log('[refresh-fb-token] Vercel env var updated successfully');
    } else {
      console.warn('[refresh-fb-token] VERCEL_ACCESS_TOKEN not set — token refreshed but not saved to Vercel');
    }

    const expiresInDays = Math.round(expiresIn / 86400);
    await sendTelegramMessage(
      `🔄 <b>FB Token Refreshed</b>\n\n` +
      `✅ New token generated\n` +
      `⏳ Expires in: ${expiresInDays} days\n` +
      `🔁 Next refresh: ~50 days`
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      expiresInDays,
      vercelUpdated: !!(process.env.VERCEL_ACCESS_TOKEN && process.env.VERCEL_PROJECT_ID),
    });

  } catch (err: any) {
    console.error('[refresh-fb-token]', err.message);
    await sendTelegramMessage(
      `❌ <b>FB Token Refresh FAILED</b>\n\n${err.message}`
    ).catch(() => {});
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
