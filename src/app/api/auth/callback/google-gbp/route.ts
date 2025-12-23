import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthManager } from '@/lib/google-oauth';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/auth/callback/google-gbp
 * OAuth2 callback handler for Google Business Profile
 * Note: This was moved from /api/auth/callback/google to avoid conflict with NextAuth's Google sign-in callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/dashboard?error=oauth_failed`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=no_code`, request.url)
      );
    }

    // Extract client ID from state
    const clientId = state?.replace('gbp-auth-', '') || '';

    const oauthManager = new GoogleOAuthManager();
    const tokens = await oauthManager.getTokensFromCode(code);

    console.log('[OAuth] Received tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expiry_date,
    });

    // Store refresh token in a local file for this client
    if (tokens.refresh_token && clientId) {
      console.log('[OAuth] Attempting to store tokens for client:', clientId);

      try {
        const tokensDir = path.join(process.cwd(), '.oauth-tokens');
        if (!fs.existsSync(tokensDir)) {
          fs.mkdirSync(tokensDir, { recursive: true });
        }

        const tokenFile = path.join(tokensDir, `${clientId}-gbp.json`);
        fs.writeFileSync(tokenFile, JSON.stringify({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expiry: tokens.expiry_date,
          updated_at: new Date().toISOString(),
        }, null, 2));

        console.log('[OAuth] Tokens stored successfully in file:', tokenFile);
      } catch (error: any) {
        console.error('[OAuth] Error storing tokens to file:', error.message);
      }
    }

    // Redirect back to dashboard with success message
    return NextResponse.redirect(
      new URL(`/dashboard?gbp_auth=success`, request.url)
    );
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=callback_failed`, request.url)
    );
  }
}
