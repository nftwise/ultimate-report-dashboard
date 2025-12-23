import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

/**
 * GET /api/admin/test-gbp-api
 * Test live GBP API call for a client
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientSlug = searchParams.get('client') || 'decarlo-chiro';
    const days = parseInt(searchParams.get('days') || '7');

    // Get client info
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          gbp_location_id
        )
      `)
      .eq('slug', clientSlug)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const config = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs || {};

    const locationId = config.gbp_location_id;
    if (!locationId) {
      return NextResponse.json({ error: 'No GBP location ID configured' }, { status: 400 });
    }

    // Find OAuth token
    const tokensDir = path.join(process.cwd(), '.oauth-tokens');
    const possibleFiles = [
      'agency-gbp-master-gbp.json', // Agency master token (preferred)
      'agency-gbp-master.json',     // Legacy name
      `${client.id}-gbp.json`,
      `${client.slug}-gbp.json`,
    ];

    let tokenFile = '';
    for (const file of possibleFiles) {
      const fullPath = path.join(tokensDir, file);
      if (fs.existsSync(fullPath)) {
        tokenFile = fullPath;
        break;
      }
    }

    if (!tokenFile) {
      return NextResponse.json({ error: 'No OAuth token found' }, { status: 400 });
    }

    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    const tokenFileName = path.basename(tokenFile);

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

    // Prepare different location ID formats to test
    const locationFormats: { format: string; value: string }[] = [];

    // Format 1: Full path as stored (accounts/XXX/locations/YYY)
    if (locationId.includes('/')) {
      locationFormats.push({ format: 'full_path', value: locationId });
    }

    // Format 2: Just locations/YYY
    if (locationId.includes('/locations/')) {
      const locationPart = locationId.split('/locations/')[1];
      locationFormats.push({ format: 'locations_only', value: `locations/${locationPart}` });
    } else if (!locationId.startsWith('locations/')) {
      locationFormats.push({ format: 'locations_only', value: `locations/${locationId}` });
    } else {
      locationFormats.push({ format: 'locations_only', value: locationId });
    }

    // Format 3: Just the numeric ID
    const numericId = locationId.replace(/.*\//, '');
    locationFormats.push({ format: 'numeric_only', value: numericId });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dateRange = {
      startDate: {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        day: startDate.getDate(),
      },
      endDate: {
        year: endDate.getFullYear(),
        month: endDate.getMonth() + 1,
        day: endDate.getDate(),
      },
    };

    // First, try to list accessible accounts/locations
    let accessibleAccounts: any[] = [];
    let accountsError: string | null = null;

    try {
      // List accounts accessible by this token
      const accountsResponse = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        accessibleAccounts = accountsData.accounts || [];

        // For each account, try to list locations
        for (const account of accessibleAccounts) {
          try {
            const locationsResponse = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
              {
                headers: { 'Authorization': `Bearer ${token}` },
              }
            );
            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json();
              account.locations = (locationsData.locations || []).map((loc: any) => ({
                name: loc.name,
                title: loc.title,
                storefrontAddress: loc.storefrontAddress?.locality,
              }));
            } else {
              account.locationsError = `${locationsResponse.status}: ${await locationsResponse.text().then(t => t.substring(0, 100))}`;
            }
          } catch (e: any) {
            account.locationsError = e.message;
          }
        }
      } else {
        accountsError = `${accountsResponse.status}: ${await accountsResponse.text().then(t => t.substring(0, 200))}`;
      }
    } catch (e: any) {
      accountsError = e.message;
    }

    // Test all location formats
    const formatResults: any[] = [];
    let workingFormat: string | null = null;
    let workingData: any = null;

    for (const { format, value } of locationFormats) {
      // Try the getDailyMetricsTimeSeries API with each format
      const apiUrl = `https://businessprofileperformance.googleapis.com/v1/${value}:getDailyMetricsTimeSeries`;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dailyMetric: 'ACTIONS_PHONE',
            dailyRange: dateRange,
          }),
        });

        const statusCode = response.status;
        let result: any = null;
        let errorText: string | null = null;

        if (response.ok) {
          result = await response.json();
          if (!workingFormat) {
            workingFormat = format;
            workingData = result;
          }
        } else {
          const text = await response.text();
          // Extract just the error message, not full HTML
          if (text.includes('404')) {
            errorText = '404 Not Found';
          } else if (text.includes('403')) {
            errorText = '403 Forbidden - No access';
          } else if (text.includes('400')) {
            errorText = '400 Bad Request';
          } else {
            errorText = text.substring(0, 200);
          }
        }

        formatResults.push({
          format,
          locationValue: value,
          url: apiUrl,
          status: statusCode,
          success: response.ok,
          error: errorText,
          hasData: result?.timeSeries?.datedValues?.length > 0,
        });
      } catch (e: any) {
        formatResults.push({
          format,
          locationValue: value,
          success: false,
          error: e.message,
        });
      }
    }

    // Parse working data
    let totalCalls = 0;
    let dailyBreakdown: any[] = [];

    if (workingData?.timeSeries?.datedValues) {
      dailyBreakdown = workingData.timeSeries.datedValues;
      totalCalls = dailyBreakdown.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
    }

    return NextResponse.json({
      success: true,
      client: {
        name: client.name,
        slug: client.slug,
        storedLocationId: locationId,
        tokenFile: tokenFileName,
      },
      dateRange: {
        start: `${dateRange.startDate.year}-${dateRange.startDate.month}-${dateRange.startDate.day}`,
        end: `${dateRange.endDate.year}-${dateRange.endDate.month}-${dateRange.endDate.day}`,
        days,
      },
      results: {
        totalCalls,
        dailyBreakdown: dailyBreakdown.slice(0, 10),
        workingFormat,
      },
      formatTests: formatResults,
      accountAccess: {
        error: accountsError,
        accounts: accessibleAccounts,
      },
      locationInfo: await getLocationInfo(token, locationId),
    });

    async function getLocationInfo(accessToken: string, locId: string) {
      // Try to get location directly from Business Information API
      const formats = [
        locId, // full path: accounts/XXX/locations/YYY
        locId.includes('/locations/') ? `locations/${locId.split('/locations/')[1]}` : `locations/${locId}`,
      ];

      for (const format of formats) {
        try {
          const response = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${format}?readMask=name,title,storefrontAddress`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (response.ok) {
            return { format, data: await response.json() };
          } else {
            const errorText = await response.text();
            return { format, error: `${response.status}: ${errorText.substring(0, 200)}` };
          }
        } catch (e: any) {
          return { format, error: e.message };
        }
      }
      return { error: 'All formats failed' };
    }

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
