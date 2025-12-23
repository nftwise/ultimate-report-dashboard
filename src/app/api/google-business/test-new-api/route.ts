import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { getCachedOrFetch, generateCacheKey } from '@/lib/smart-cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/google-business/test-new-api
 * Test the NEW fetchMultiDailyMetricsTimeSeries API method (with caching)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    let locationId = searchParams.get('locationId'); // Just the location number, e.g., "1203151849529238982"
    const daysParam = searchParams.get('days'); // Optional: number of days to fetch (default 30, max 540 = 18 months)
    const startDateParam = searchParams.get('startDate'); // Optional: YYYY-MM-DD format
    const endDateParam = searchParams.get('endDate'); // Optional: YYYY-MM-DD format
    const forceFresh = searchParams.get('forceFresh') === 'true'; // Optional: skip cache

    // Get session for OAuth token
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string } } | null;
    const accessToken = session?.user?.accessToken;
    console.log('[GBP] Has OAuth access token:', !!accessToken);

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    // If locationId is not provided, try to fetch from database
    if (!locationId || locationId === 'undefined' || locationId === 'null' || locationId.trim() === '') {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: serviceConfig } = await supabase
        .from('service_configs')
        .select('gbp_location_id')
        .eq('client_id', clientId)
        .single();

      locationId = serviceConfig?.gbp_location_id || null;
    }

    // If still no locationId, return proper error
    if (!locationId || locationId.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'GBP Location ID not configured for this client',
        message: 'Please configure the GBP Location ID in the admin panel'
      }, { status: 404 });
    }

    // Calculate date range for cache key
    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else if (daysParam) {
      const days = Math.min(parseInt(daysParam), 540);
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Generate cache key
    const cacheKey = generateCacheKey('gbp', clientId, {
      locationId,
      startDate: startDateStr,
      endDate: endDateStr
    });

    // Use cached data or fetch fresh
    const data = await getCachedOrFetch(
      cacheKey,
      async () => {
        // Original fetch logic wrapped in async function
        return await fetchGBPData(clientId, locationId as string, startDate, endDate, accessToken);
      },
      {
        source: 'gbp',
        clientId,
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr
        },
        forceFresh
      }
    );

    return NextResponse.json({
      success: true,
      ...data
    });

  } catch (error: any) {
    console.error('Error testing new GBP API:', error);

    // Return 404 for configuration issues, 500 for other errors
    const isConfigError = error.message?.includes('OAuth token not found') ||
                          error.message?.includes('not configured');

    return NextResponse.json({
      success: false,
      error: isConfigError ? 'GBP not configured for this client' : 'Failed to test API',
      details: error.message,
      message: isConfigError ? 'Please connect Google Business Profile in the admin panel' : undefined
    }, { status: isConfigError ? 404 : 500 });
  }
}

/**
 * Extracted fetch logic for GBP data
 */
async function fetchGBPData(clientId: string, locationId: string, startDate: Date, endDate: Date, accessToken?: string) {
  let token: string;

  // Use OAuth access token from session if provided
  if (accessToken) {
    console.log('[GBP] Using OAuth access token from session');
    token = accessToken;
  } else {
    // Fallback to file-based tokens - Try agency master token first
    console.log('[GBP] No session token, trying file-based tokens');
    let tokenFile = path.join(process.cwd(), '.oauth-tokens', 'agency-gbp-master.json');

    // If no master token, try client-specific token
    if (!fs.existsSync(tokenFile)) {
      tokenFile = path.join(process.cwd(), '.oauth-tokens', `${clientId}-gbp.json`);
    }

    // If not found and clientId looks like a slug (not a UUID), try to find UUID version
    if (!fs.existsSync(tokenFile)) {
      // List all token files and try to find a UUID-based one
      const tokenDir = path.join(process.cwd(), '.oauth-tokens');
      if (!fs.existsSync(tokenDir)) {
        throw new Error('GBP not configured. Please sign in with Google OAuth to access Business Profile data.');
      }
      const files = fs.readdirSync(tokenDir).filter(f => f.endsWith('-gbp.json'));

      // If there's only one GBP token file, use it
      if (files.length === 1) {
        tokenFile = path.join(tokenDir, files[0]);
        console.log(`[GBP API] Using fallback token file: ${files[0]}`);
      } else {
        throw new Error('GBP not configured. Please sign in with Google OAuth to access Business Profile data.');
      }
    }

    console.log(`[GBP API] Using token from: ${tokenFile}`);
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-business/callback`
    );

    oauth2Client.setCredentials(tokens);

    // Get access token
    const tokenResponse = await oauth2Client.getAccessToken();
    token = tokenResponse.token || '';

    if (!token) {
      throw new Error('Failed to get access token from stored credentials');
    }
  }

  console.log(`[GBP] Testing NEW API for location: ${locationId}`);

  // Extract just the location ID from the full path
  // locationId comes in as "accounts/111728963099305708584/locations/1203151849529238982"
  // But the Performance API expects "locations/1203151849529238982"
  let resourceName = locationId;
  if (locationId.includes('accounts/')) {
    // Extract just "locations/{id}" part
    const match = locationId.match(/locations\/\d+/);
    if (match) {
      resourceName = match[0];
      console.log(`[GBP] Extracted resource name: ${resourceName}`);
    }
  }

  // Add multiple metrics (note: PHOTOS_VIEWS metrics are not supported by Google's API)
  const metricsToFetch = [
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  ];

  // Build URL with multiple dailyMetrics parameters
  let queryString = '';
  metricsToFetch.forEach(metric => {
    queryString += `dailyMetrics=${metric}&`;
  });
  queryString += `dailyRange.startDate.year=${startDate.getFullYear()}&`;
  queryString += `dailyRange.startDate.month=${startDate.getMonth() + 1}&`;
  queryString += `dailyRange.startDate.day=${startDate.getDate()}&`;
  queryString += `dailyRange.endDate.year=${endDate.getFullYear()}&`;
  queryString += `dailyRange.endDate.month=${endDate.getMonth() + 1}&`;
  queryString += `dailyRange.endDate.day=${endDate.getDate()}`;

  // Use the extracted resource name format: "locations/{id}"
  const apiUrl = `https://businessprofileperformance.googleapis.com/v1/${resourceName}:fetchMultiDailyMetricsTimeSeries?${queryString}`;

  console.log(`[GBP] API URL: ${apiUrl}`);

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`[GBP] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[GBP] Error response:`, errorText);
    throw new Error(`GBP API returned ${response.status}: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[GBP] Success! Data received:`, JSON.stringify(data, null, 2));

  // Parse the multi-metric response
  const metrics: any = {};

  if (data.multiDailyMetricTimeSeries && data.multiDailyMetricTimeSeries[0]?.dailyMetricTimeSeries) {
    data.multiDailyMetricTimeSeries[0].dailyMetricTimeSeries.forEach((series: any) => {
      const metricName = series.dailyMetric;
      let total = 0;

      if (series.timeSeries?.datedValues) {
        total = series.timeSeries.datedValues.reduce((sum: number, item: any) => {
          return sum + (parseInt(item.value) || 0);
        }, 0);
      }

      metrics[metricName] = {
        total,
        timeSeries: series.timeSeries,
      };
    });
  }

  // Get connected email from service_configs (if available)
  let connectedEmail: string | null = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: serviceConfig } = await supabase
      .from('service_configs')
      .select('gbp_connected_email')
      .eq('client_id', clientId)
      .single();

    connectedEmail = serviceConfig?.gbp_connected_email || null;
    console.log('[GBP] Connected email:', connectedEmail);
  } catch (error) {
    console.log('[GBP] Could not fetch connected email from database');
  }

  // Return plain data object (not NextResponse)
  return {
    data: {
      locationId,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      metrics,
      rawResponse: data,
      connectedEmail,
    },
  };
}
