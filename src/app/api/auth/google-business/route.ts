import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/auth/google-business
 * Initiates OAuth2 flow for Google Business Profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-business/callback`
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important: get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      scope: [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.email', // Get user's email
      ],
      state: clientId, // Pass clientId through state parameter
    });

    console.log('[GBP OAuth] Redirecting to auth URL for client:', clientId);

    return NextResponse.json({
      success: true,
      authUrl,
    });

  } catch (error: any) {
    console.error('Error initiating GBP OAuth:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate OAuth flow',
      details: error.message,
    }, { status: 500 });
  }
}
