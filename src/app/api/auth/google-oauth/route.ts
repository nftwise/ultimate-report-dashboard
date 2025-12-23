import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthManager } from '@/lib/google-oauth';

/**
 * GET /api/auth/google-oauth
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

    const oauthManager = new GoogleOAuthManager();
    const authUrl = oauthManager.getAuthUrl(`gbp-auth-${clientId}`);

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Error initiating OAuth:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate OAuth flow',
      details: error.message,
    }, { status: 500 });
  }
}
