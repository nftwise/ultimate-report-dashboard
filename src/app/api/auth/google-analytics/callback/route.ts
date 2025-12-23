import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/auth/google-analytics/callback
 * Handles OAuth2 callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the clientId
    const error = searchParams.get('error');

    if (error) {
      console.error('[GA OAuth] User denied access:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=access_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.json({
        success: false,
        error: 'Missing code or state parameter'
      }, { status: 400 });
    }

    const clientId = state;

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-analytics/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log('[GA OAuth] Tokens received for client:', clientId);
    console.log('[GA OAuth] Has refresh token:', !!tokens.refresh_token);

    if (!tokens.refresh_token) {
      console.error('[GA OAuth] No refresh token received!');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=no_refresh_token`
      );
    }

    // Get the user's email from Google
    let userEmail: string | null = null;
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      userEmail = data.email || null;
      console.log('[GA OAuth] Connected Google account:', userEmail);
    } catch (emailError) {
      console.error('[GA OAuth] Could not fetch user email:', emailError);
    }

    // Save tokens to file
    const tokenDir = path.join(process.cwd(), '.oauth-tokens');
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    const tokenFile = path.join(tokenDir, `${clientId}-ga.json`);
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));

    console.log('[GA OAuth] Tokens saved to:', tokenFile);

    // Update service_configs with connected email (if we have it)
    if (userEmail) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabase
          .from('service_configs')
          .update({ ga_connected_email: userEmail })
          .eq('client_id', clientId);

        if (updateError) {
          console.error('[GA OAuth] Could not save connected email:', updateError);
        } else {
          console.log('[GA OAuth] Saved connected email to database');
        }
      } catch (dbError) {
        console.error('[GA OAuth] Database error:', dbError);
      }
    }

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?ga_connected=true`
    );

  } catch (error: any) {
    console.error('Error in GA OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed`
    );
  }
}
