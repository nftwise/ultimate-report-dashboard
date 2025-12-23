import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/locations
 * List all locations accessible with OAuth token
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
    console.log(`[GBP Locations] Using token from: ${tokenFile}`);

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

    // List accounts
    const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      const error = await accountsResponse.text();
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch accounts',
        details: error,
      }, { status: accountsResponse.status });
    }

    const accountsData = await accountsResponse.json();
    console.log('[GBP] Accounts:', accountsData);

    // Get locations for each account
    const allLocations = [];
    const debugInfo: any = {
      accountsCount: accountsData.accounts?.length || 0,
      locationsAttempts: [],
    };

    if (accountsData.accounts && accountsData.accounts.length > 0) {
      for (const account of accountsData.accounts) {
        const accountName = account.name;
        console.log(`[GBP] Fetching locations for account: ${accountName}`);

        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,websiteUri,phoneNumbers,metadata,profile`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const attemptInfo: any = {
          accountName,
          accountType: account.type,
          status: locationsResponse.status,
          statusText: locationsResponse.statusText,
        };

        if (locationsResponse.ok) {
          const locationsData = await locationsResponse.json();
          console.log(`[GBP] Locations for ${accountName}:`, JSON.stringify(locationsData, null, 2));

          attemptInfo.locationsFound = locationsData.locations?.length || 0;
          attemptInfo.rawResponse = locationsData;

          if (locationsData.locations) {
            allLocations.push(...locationsData.locations.map((loc: any) => {
              // Format address from storefrontAddress
              let formattedAddress = 'N/A';
              if (loc.storefrontAddress) {
                const addr = loc.storefrontAddress;
                const parts = [
                  ...(addr.addressLines || []),
                  addr.locality,
                  addr.administrativeArea,
                  addr.postalCode
                ].filter(Boolean);
                formattedAddress = parts.join(', ');
              }

              return {
                name: loc.name,
                title: loc.title,
                storeCode: loc.storeCode,
                address: formattedAddress,
                primaryPhone: loc.phoneNumbers?.primaryPhone || 'N/A',
                websiteUri: loc.websiteUri || 'N/A',
                locationState: loc.locationState?.isVerified ? 'Verified' : 'Not Verified',
              };
            }));
          }
        } else {
          const errorText = await locationsResponse.text();
          console.error(`[GBP] Error fetching locations for ${accountName}:`, errorText);
          attemptInfo.error = errorText;
        }

        debugInfo.locationsAttempts.push(attemptInfo);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsData.accounts || [],
        locations: allLocations,
        debug: debugInfo,
      },
    });

  } catch (error: any) {
    console.error('Error listing GBP locations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list locations',
      details: error.message,
    }, { status: 500 });
  }
}
