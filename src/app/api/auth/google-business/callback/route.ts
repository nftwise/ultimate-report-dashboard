import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleBusinessProfileConnector } from '@/lib/google-business-profile';

/**
 * GET /api/auth/google-business/callback
 * Handles OAuth2 callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the clientId
    const error = searchParams.get('error');

    if (error) {
      console.error('[GBP OAuth] User denied access:', error);
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
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-business/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log('[GBP OAuth] Tokens received for client:', clientId);
    console.log('[GBP OAuth] Has refresh token:', !!tokens.refresh_token);

    if (!tokens.refresh_token) {
      console.error('[GBP OAuth] No refresh token received!');
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
      console.log('[GBP OAuth] Connected Google account:', userEmail);
    } catch (emailError) {
      console.error('[GBP OAuth] Could not fetch user email:', emailError);
    }

    // Save tokens to file
    const tokenDir = path.join(process.cwd(), '.oauth-tokens');
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    const tokenFile = path.join(tokenDir, `${clientId}-gbp.json`);
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));

    console.log('[GBP OAuth] Tokens saved to:', tokenFile);

    // Auto-discover GBP accounts and locations
    let gbpLocationId: string | null = null;
    let gbpAccountId: string | null = null;

    try {
      console.log('[GBP OAuth] Auto-discovering accounts and locations...');
      const { accounts, locations } = await GoogleBusinessProfileConnector.fetchAccountsAndLocations(tokens.access_token!);

      console.log(`[GBP OAuth] Found ${accounts.length} accounts and ${locations.length} locations`);

      if (accounts.length > 0) {
        gbpAccountId = accounts[0].name; // e.g., "accounts/123456789"
      }

      if (locations.length > 0) {
        gbpLocationId = locations[0].name; // e.g., "locations/123456789"
        console.log(`[GBP OAuth] Auto-selected location: ${locations[0].title} (${gbpLocationId})`);
      }
    } catch (discoveryError: any) {
      console.error('[GBP OAuth] Could not auto-discover locations:', discoveryError.message);
      // Continue anyway - we still have the OAuth tokens saved
    }

    // Update service_configs with connected email and location
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const updateData: Record<string, string | null> = {};

      if (userEmail) {
        updateData.gbp_connected_email = userEmail;
      }
      if (gbpLocationId) {
        updateData.gbp_location_id = gbpLocationId;
      }
      if (gbpAccountId) {
        updateData.gbp_account_id = gbpAccountId;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('service_configs')
          .update(updateData)
          .eq('client_id', clientId);

        if (updateError) {
          console.error('[GBP OAuth] Could not save to database:', updateError);
        } else {
          console.log('[GBP OAuth] Saved to database:', updateData);
        }
      }
    } catch (dbError) {
      console.error('[GBP OAuth] Database error:', dbError);
    }

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?gbp_connected=true`
    );

  } catch (error: any) {
    console.error('Error in GBP OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed`
    );
  }
}
