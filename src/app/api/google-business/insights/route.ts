import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/insights
 * Try to fetch insights data including call metrics using My Business API v4
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const locationId = searchParams.get('locationId');

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
    console.log(`[GBP Insights] Using token from: ${tokenFile}`);

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

    // Try different insight/report APIs
    const attempts: Array<{ api: string; status?: number; statusText?: string; success?: boolean; error?: string }> = [];

    // Try 1: My Business API v4 - reportInsights (legacy)
    try {
      const metricsToFetch = [
        'QUERIES_DIRECT',
        'QUERIES_INDIRECT',
        'VIEWS_MAPS',
        'VIEWS_SEARCH',
        'ACTIONS_WEBSITE',
        'ACTIONS_PHONE',
        'ACTIONS_DRIVING_DIRECTIONS',
        'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
        'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
        'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
        'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
        'BUSINESS_CONVERSATIONS',
        'BUSINESS_DIRECTION_REQUESTS',
        'CALL_CLICKS',
        'BUSINESS_BOOKINGS',
        'BUSINESS_FOOD_ORDERS',
        'BUSINESS_FOOD_MENU_CLICKS',
      ];

      const response = await fetch(
        `https://mybusiness.googleapis.com/v4/${fullLocationPath}/locations:reportInsights`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locationNames: [fullLocationPath],
            basicRequest: {
              metricRequests: metricsToFetch.map(metric => ({
                metric,
              })),
              timeRange: {
                startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date().toISOString(),
              },
            },
          }),
        }
      );

      attempts.push({
        api: 'My Business API v4 - reportInsights',
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          data,
          source: 'My Business API v4 - reportInsights',
        });
      } else {
        const errorText = await response.text();
        attempts[attempts.length - 1].error = errorText;
      }
    } catch (error: any) {
      attempts.push({
        api: 'My Business API v4 - reportInsights',
        error: error.message,
      });
    }

    // Try 2: Get location insights (simpler endpoint)
    try {
      const response = await fetch(
        `https://mybusiness.googleapis.com/v4/${fullLocationPath}/insights`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      attempts.push({
        api: 'My Business API v4 - insights',
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          data,
          source: 'My Business API v4 - insights',
        });
      } else {
        const errorText = await response.text();
        attempts[attempts.length - 1].error = errorText;
      }
    } catch (error: any) {
      attempts.push({
        api: 'My Business API v4 - insights',
        error: error.message,
      });
    }

    // No API worked
    return NextResponse.json({
      success: false,
      error: 'Unable to fetch insights from any API',
      attempts,
    });

  } catch (error: any) {
    console.error('Error fetching insights:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch insights',
      details: error.message,
    }, { status: 500 });
  }
}
