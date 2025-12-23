import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/location-details
 * Get detailed information about a specific location including verification status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const locationId = searchParams.get('locationId'); // e.g., "locations/1203151849529238982"

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId parameter is required'
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
    console.log(`[GBP Location Details] Using token from: ${tokenFile}`);

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

    // Get account from locations list first
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

    // Fetch detailed location information with available fields
    const locationResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/${locationId}?readMask=*`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!locationResponse.ok) {
      const errorText = await locationResponse.text();
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch location details',
        details: errorText,
      }, { status: locationResponse.status });
    }

    const locationData = await locationResponse.json();

    // Try to fetch reviews (may require additional permissions)
    let reviews = null;
    try {
      const reviewsResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/${accountName}/${locationId}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (reviewsResponse.ok) {
        reviews = await reviewsResponse.json();
      }
    } catch (error) {
      console.log('[GBP] Reviews API not accessible:', error);
    }

    // Format the response
    const formattedData = {
      name: locationData.name,
      title: locationData.title,
      address: locationData.storefrontAddress,
      phoneNumbers: locationData.phoneNumbers,
      websiteUri: locationData.websiteUri,
      categories: locationData.categories,
      storeCode: locationData.storeCode,
      labels: locationData.labels,
      metadata: locationData.metadata,
      profile: locationData.profile,
      relationshipData: locationData.relationshipData,
      regularHours: locationData.regularHours,
      specialHours: locationData.specialHours,
      moreHours: locationData.moreHours,
      openInfo: locationData.openInfo,
      serviceArea: locationData.serviceArea,
      serviceItems: locationData.serviceItems,
      adWordsLocationExtensions: locationData.adWordsLocationExtensions,
    };

    return NextResponse.json({
      success: true,
      data: {
        location: formattedData,
        reviews: reviews,
        rawLocation: locationData,
      },
    });

  } catch (error: any) {
    console.error('Error fetching location details:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch location details',
      details: error.message,
    }, { status: 500 });
  }
}
