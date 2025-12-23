import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/call-insights
 * Fetch business call insights using the Business Calls API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const locationId = searchParams.get('locationId'); // e.g., "locations/1203151849529238982"

    if (!clientId || !locationId) {
      return NextResponse.json({
        success: false,
        error: 'clientId and locationId parameters are required'
      }, { status: 400 });
    }

    // Load OAuth tokens - Try agency master token first, then client-specific token
    let tokenFile = path.join(process.cwd(), '.oauth-tokens', 'agency-gbp-master.json');

    // If no master token, fall back to client-specific token
    if (!fs.existsSync(tokenFile)) {
      tokenFile = path.join(process.cwd(), '.oauth-tokens', `${clientId}-gbp.json`);
    }

    if (!fs.existsSync(tokenFile)) {
      return NextResponse.json({
        success: false,
        error: 'OAuth token not found. Please connect Google Business Profile first.',
        needsConnection: true
      }, { status: 404 });
    }

    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    console.log(`[GBP Call Insights] Using token from: ${tokenFile}`);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-business/callback`
    );

    oauth2Client.setCredentials(tokens);

    // Get access token
    const { token } = await oauth2Client.getAccessToken();

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get access token'
      }, { status: 401 });
    }

    // Get account
    const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const accountsData = await accountsResponse.json();
    const accountName = accountsData.accounts?.[0]?.name;

    if (!accountName) {
      return NextResponse.json({
        success: false,
        error: 'No account found'
      }, { status: 404 });
    }

    const fullLocationPath = `${accountName}/${locationId}`;

    console.log(`[GBP] Fetching call insights for: ${fullLocationPath}`);

    // Try the Business Calls Insights API
    const callInsightsResponse = await fetch(
      `https://mybusinessbusinesscalls.googleapis.com/v1/${fullLocationPath}/businesscallsinsights`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[GBP] Call Insights API status: ${callInsightsResponse.status}`);

    if (callInsightsResponse.ok) {
      const data = await callInsightsResponse.json();
      return NextResponse.json({
        success: true,
        data,
        source: 'Business Calls Insights API',
      });
    }

    const errorText = await callInsightsResponse.text();
    console.error(`[GBP] Call Insights API error:`, errorText);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch call insights',
      status: callInsightsResponse.status,
      statusText: callInsightsResponse.statusText,
      details: errorText,
    });

  } catch (error: any) {
    console.error('Error fetching call insights:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch call insights',
      details: error.message,
    }, { status: 500 });
  }
}
