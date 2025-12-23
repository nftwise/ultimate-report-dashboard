import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business/performance
 * Fetch performance metrics for a location
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const locationId = searchParams.get('locationId');
    const days = parseInt(searchParams.get('days') || '30');

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
    console.log(`[GBP] Using token from: ${tokenFile}`);

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

    console.log(`[GBP] Fetching metrics for ${locationId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch multiple metrics in parallel
    const metricTypes = [
      'QUERIES_DIRECT',
      'QUERIES_INDIRECT',
      'VIEWS_MAPS',
      'VIEWS_SEARCH',
      'ACTIONS_WEBSITE',
      'ACTIONS_PHONE',
      'ACTIONS_DRIVING_DIRECTIONS',
      'PHOTOS_VIEWS_MERCHANT',
      'PHOTOS_VIEWS_CUSTOMERS',
    ];

    const metricsPromises = metricTypes.map(async (metricType) => {
      try {
        const response = await fetch(
          `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dailyMetric: metricType,
              dailyRange: dateRange,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[GBP] Error fetching ${metricType}:`, errorText);
          return { metricType, success: false, error: errorText, total: 0 };
        }

        const data = await response.json();

        // Sum up the time series data
        let total = 0;
        if (data.timeSeries && data.timeSeries.datedValues) {
          total = data.timeSeries.datedValues.reduce((sum: number, item: any) => {
            return sum + (item.value || 0);
          }, 0);
        }

        console.log(`[GBP] ${metricType}: ${total}`);

        return {
          metricType,
          success: true,
          total,
          timeSeries: data.timeSeries,
        };
      } catch (error: any) {
        console.error(`[GBP] Error fetching ${metricType}:`, error);
        return { metricType, success: false, error: error.message, total: 0 };
      }
    });

    const results = await Promise.all(metricsPromises);

    // Aggregate metrics
    const metrics: any = {
      searchQueries: {
        direct: 0,
        indirect: 0,
        total: 0,
      },
      views: {
        search: 0,
        maps: 0,
        total: 0,
      },
      actions: {
        website: 0,
        phone: 0,
        directions: 0,
        total: 0,
      },
      photos: {
        merchantViews: 0,
        customerViews: 0,
        totalViews: 0,
      },
    };

    results.forEach(({ metricType, total }) => {
      switch (metricType) {
        case 'QUERIES_DIRECT':
          metrics.searchQueries.direct = total;
          break;
        case 'QUERIES_INDIRECT':
          metrics.searchQueries.indirect = total;
          break;
        case 'VIEWS_MAPS':
          metrics.views.maps = total;
          break;
        case 'VIEWS_SEARCH':
          metrics.views.search = total;
          break;
        case 'ACTIONS_WEBSITE':
          metrics.actions.website = total;
          break;
        case 'ACTIONS_PHONE':
          metrics.actions.phone = total;
          break;
        case 'ACTIONS_DRIVING_DIRECTIONS':
          metrics.actions.directions = total;
          break;
        case 'PHOTOS_VIEWS_MERCHANT':
          metrics.photos.merchantViews = total;
          break;
        case 'PHOTOS_VIEWS_CUSTOMERS':
          metrics.photos.customerViews = total;
          break;
      }
    });

    // Calculate totals
    metrics.searchQueries.total = metrics.searchQueries.direct + metrics.searchQueries.indirect;
    metrics.views.total = metrics.views.search + metrics.views.maps;
    metrics.actions.total = metrics.actions.website + metrics.actions.phone + metrics.actions.directions;
    metrics.photos.totalViews = metrics.photos.merchantViews + metrics.photos.customerViews;

    return NextResponse.json({
      success: true,
      data: {
        locationId,
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          days,
        },
        metrics,
        rawResults: results,
      },
    });

  } catch (error: any) {
    console.error('Error fetching GBP performance metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch performance metrics',
      details: error.message,
    }, { status: 500 });
  }
}
