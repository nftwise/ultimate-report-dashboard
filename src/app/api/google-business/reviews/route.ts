import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/reviews
 * Fetch reviews for a location
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
    console.log(`[GBP Reviews] Using token from: ${tokenFile}`);

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

    // Try different review APIs
    const apiAttempts = [];

    // Try 1: My Business API v4
    try {
      const v4Response = await fetch(
        `https://mybusiness.googleapis.com/v4/${fullLocationPath}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      apiAttempts.push({
        api: 'My Business API v4',
        url: `https://mybusiness.googleapis.com/v4/${fullLocationPath}/reviews`,
        status: v4Response.status,
        statusText: v4Response.statusText,
        success: v4Response.ok,
      });

      if (v4Response.ok) {
        const data = await v4Response.json();
        return NextResponse.json({
          success: true,
          data,
          source: 'My Business API v4',
        });
      }
    } catch (error: any) {
      apiAttempts.push({
        api: 'My Business API v4',
        error: error.message,
      });
    }

    // Try 2: Account Management API
    try {
      const mgmtResponse = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${fullLocationPath}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      apiAttempts.push({
        api: 'Account Management API',
        url: `https://mybusinessaccountmanagement.googleapis.com/v1/${fullLocationPath}/reviews`,
        status: mgmtResponse.status,
        statusText: mgmtResponse.statusText,
        success: mgmtResponse.ok,
      });

      if (mgmtResponse.ok) {
        const data = await mgmtResponse.json();
        return NextResponse.json({
          success: true,
          data,
          source: 'Account Management API',
        });
      }
    } catch (error: any) {
      apiAttempts.push({
        api: 'Account Management API',
        error: error.message,
      });
    }

    // No API worked
    return NextResponse.json({
      success: false,
      error: 'Unable to fetch reviews from any API',
      attempts: apiAttempts,
    });

  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch reviews',
      details: error.message,
    }, { status: 500 });
  }
}
