/**
 * API Route: Refresh GBP OAuth token on Vercel
 * This creates a new token that matches the NEW OAuth credentials
 *
 * Usage: https://ultimate-report-dashboard.vercel.app/api/auth/gbp-refresh-token
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  // Step 1: If no code, show authorization link
  if (!code) {
    const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
    // Auto-detect Vercel URL or use env variable
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/gbp-refresh-token`;

    const SCOPES = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Refresh GBP OAuth Token</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              line-height: 1.6;
            }
            .container {
              background: #f8fafc;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              padding: 30px;
            }
            h1 {
              color: #1e293b;
              margin-top: 0;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info {
              background: #dbeafe;
              border-left: 4px solid #3b82f6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .btn {
              display: inline-block;
              background: #10b981;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 20px;
              transition: background 0.2s;
            }
            .btn:hover {
              background: #059669;
            }
            ul {
              margin: 10px 0;
            }
            li {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 Refresh GBP OAuth Token</h1>

            <div class="warning">
              <strong>⚠️ Important:</strong> This will replace your existing GBP token with a new one that matches your current OAuth credentials.
            </div>

            <div class="info">
              <strong>📋 What this does:</strong>
              <ul>
                <li>Creates a new OAuth token using the NEW credentials on Vercel</li>
                <li>Saves the token to Supabase production database</li>
                <li>Fixes the 401 "unauthorized_client" error</li>
                <li>Enables auto-refresh for future API calls</li>
              </ul>
            </div>

            <p><strong>Next steps after clicking authorize:</strong></p>
            <ol>
              <li>Sign in with your agency Google account (seo@mychiropractice.com)</li>
              <li>Grant permissions to access Google Business Profile</li>
              <li>You'll be redirected back with success confirmation</li>
            </ol>

            <a href="${authUrl}" class="btn">🚀 Authorize & Refresh Token</a>
          </div>
        </body>
      </html>
    `);
  }

  // Step 2: Exchange code for tokens and save to Supabase
  try {
    const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/gbp-refresh-token`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received: ' + JSON.stringify(tokens));
    }

    // Save to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: upsertError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'gbp_oauth_token',
        value: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          created_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (upsertError) {
      throw new Error(`Failed to save to Supabase: ${upsertError.message}`);
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Token Refreshed Successfully</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              line-height: 1.6;
            }
            .container {
              background: #f0fdf4;
              border: 2px solid #86efac;
              border-radius: 12px;
              padding: 30px;
            }
            h1 {
              color: #16a34a;
              margin-top: 0;
            }
            .success {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .next-steps {
              background: #dbeafe;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            code {
              background: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
            }
            ul, ol {
              margin: 10px 0;
            }
            li {
              margin: 8px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Success! GBP OAuth Token Refreshed</h1>

            <div class="success">
              <p><strong>✨ Token details:</strong></p>
              <ul>
                <li>📍 Saved to: <code>system_settings.gbp_oauth_token</code></li>
                <li>⏱️ Expires in: ${Math.round(tokens.expires_in / 3600)} hours</li>
                <li>🔄 Will auto-refresh when needed</li>
                <li>🎯 Matches NEW OAuth credentials on Vercel</li>
              </ul>
            </div>

            <div class="next-steps">
              <p><strong>🎯 Next Steps:</strong></p>
              <ol>
                <li><strong>Run auto-map script</strong> to map all 20-25 clients to GBP locations</li>
                <li><strong>Test 3-day backfill</strong> to verify GBP data shows up (not all zeros)</li>
                <li><strong>Run full 180-day backfill</strong> once test passes</li>
                <li><strong>Setup cronjob</strong> for daily 2AM sync</li>
              </ol>
            </div>

            <p style="color: #64748b; margin-top: 30px;">✅ You can close this window now. The token is active and ready to use!</p>
          </div>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('[GBP Token Refresh] Error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            .error {
              background: #fef2f2;
              border: 2px solid #fca5a5;
              border-radius: 12px;
              padding: 30px;
            }
            h1 { color: #dc2626; margin-top: 0; }
            pre {
              background: #f1f5f9;
              padding: 15px;
              border-radius: 8px;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Error Refreshing Token</h1>
            <pre>${error.message}</pre>
          </div>
        </body>
      </html>
    `);
  }
}
