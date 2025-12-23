import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

/**
 * GET /api/admin/list-gbp-locations
 * List ALL GBP locations accessible by the OAuth token
 * and match them with clients in the database
 */
export async function GET(request: NextRequest) {
  try {
    // Find any OAuth token to use
    const tokensDir = path.join(process.cwd(), '.oauth-tokens');
    const tokenFiles = fs.readdirSync(tokensDir).filter(f => f.endsWith('-gbp.json'));

    if (tokenFiles.length === 0) {
      return NextResponse.json({ error: 'No OAuth tokens found' }, { status: 400 });
    }

    // Use the first available token (they should all be from the same account)
    const tokenFile = path.join(tokensDir, tokenFiles[0]);
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    // Get all clients from database with their GBP location IDs
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        city,
        service_configs (
          gbp_location_id
        )
      `)
      .eq('is_active', true);

    const clientsWithGBP = (clients || []).map((c: any) => {
      const config = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs || {};
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        city: c.city,
        storedLocationId: config.gbp_location_id || null,
      };
    });

    // List all accounts
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    let accounts: any[] = [];
    let accountsError: string | null = null;

    if (accountsResponse.ok) {
      const data = await accountsResponse.json();
      accounts = data.accounts || [];
    } else {
      accountsError = await accountsResponse.text();
    }

    // For each account, list locations using different API endpoints
    const allLocations: any[] = [];

    for (const account of accounts) {
      // Try Business Information API
      try {
        const locResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (locResponse.ok) {
          const locData = await locResponse.json();
          for (const loc of (locData.locations || [])) {
            allLocations.push({
              accountName: account.name,
              accountDisplayName: account.accountName,
              locationName: loc.name,
              title: loc.title,
              city: loc.storefrontAddress?.locality,
              state: loc.storefrontAddress?.administrativeArea,
              placeId: loc.metadata?.placeId,
            });
          }
        }
      } catch (e) {
        // Try alternate method - direct locations list
      }
    }

    // Also try the My Business API v4 (legacy but sometimes works)
    try {
      const legacyResponse = await fetch(
        'https://mybusiness.googleapis.com/v4/accounts',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        for (const acc of (legacyData.accounts || [])) {
          try {
            const locResponse = await fetch(
              `https://mybusiness.googleapis.com/v4/${acc.name}/locations`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (locResponse.ok) {
              const locData = await locResponse.json();
              for (const loc of (locData.locations || [])) {
                // Check if not already added
                const exists = allLocations.find(l => l.locationName === loc.name);
                if (!exists) {
                  allLocations.push({
                    accountName: acc.name,
                    accountDisplayName: acc.accountName,
                    locationName: loc.name,
                    title: loc.locationName,
                    city: loc.address?.locality,
                    state: loc.address?.administrativeArea,
                    source: 'legacy_api',
                  });
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Match locations with clients
    const matchResults = clientsWithGBP.map((client: any) => {
      // Try to find a matching location by name or city
      const clientNameLower = client.name.toLowerCase();
      const clientCityLower = (client.city || '').split(',')[0].toLowerCase().trim();

      const matchedLocation = allLocations.find((loc: any) => {
        const locTitle = (loc.title || '').toLowerCase();
        const locCity = (loc.city || '').toLowerCase();

        // Match by title containing client name
        if (locTitle.includes(clientNameLower) || clientNameLower.includes(locTitle)) {
          return true;
        }

        // Match by city if client city matches location city
        if (clientCityLower && locCity && locCity.includes(clientCityLower)) {
          return true;
        }

        return false;
      });

      // Check if stored ID matches any known location
      const storedIdMatch = client.storedLocationId
        ? allLocations.find((loc: any) =>
            client.storedLocationId.includes(loc.locationName?.split('/').pop()) ||
            loc.locationName === client.storedLocationId
          )
        : null;

      return {
        client: {
          name: client.name,
          slug: client.slug,
          city: client.city,
        },
        storedLocationId: client.storedLocationId,
        storedIdValid: !!storedIdMatch,
        suggestedLocation: matchedLocation ? {
          locationName: matchedLocation.locationName,
          title: matchedLocation.title,
          city: matchedLocation.city,
        } : null,
        status: storedIdMatch ? 'OK' : (matchedLocation ? 'NEEDS_UPDATE' : 'NOT_FOUND'),
      };
    });

    // Summary stats
    const stats = {
      totalClients: clientsWithGBP.length,
      clientsWithStoredId: clientsWithGBP.filter((c: any) => c.storedLocationId).length,
      locationsFound: allLocations.length,
      matchedOK: matchResults.filter((m: any) => m.status === 'OK').length,
      needsUpdate: matchResults.filter((m: any) => m.status === 'NEEDS_UPDATE').length,
      notFound: matchResults.filter((m: any) => m.status === 'NOT_FOUND').length,
    };

    return NextResponse.json({
      success: true,
      tokenFile: tokenFiles[0],
      accounts: accounts.map((a: any) => ({
        name: a.name,
        displayName: a.accountName,
        type: a.type,
      })),
      accountsError,
      locationsFound: allLocations,
      clientMatching: matchResults,
      stats,
      note: 'If locationsFound is empty, the OAuth token may not have manager access to any GBP locations. Re-authenticate with the account that manages the business profiles.',
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
