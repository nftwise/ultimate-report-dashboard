import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { withCache, cacheKeys } from '@/lib/cache';
import { getTimeRangeDates } from '@/lib/utils';
import { ApiResponse } from '@/types';
import { cachedApiCall, performanceCache } from '@/lib/performance-cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const report = searchParams.get('report') || searchParams.get('type') || 'basic';
    const timeRange = getTimeRangeDates(period);

    const connector = new GoogleAnalyticsConnector();

    let result;
    
    switch (report) {
      case 'status':
        // Simple status check - verify API credentials
        try {
          if (!process.env.GOOGLE_CLIENT_EMAIL || 
              !process.env.GOOGLE_PRIVATE_KEY || 
              !process.env.GOOGLE_ANALYTICS_PROPERTY_ID) {
            throw new Error('Missing Google Analytics API credentials');
          }
          result = { data: { status: 'connected' }, cached: false };
        } catch (error) {
          throw new Error(`Google Analytics API configuration error: ${error.message}`);
        }
        break;
        
      case 'basic':
        result = await withCache(
          cacheKeys.googleAnalytics(timeRange),
          () => connector.getBasicMetrics(timeRange)
        );
        break;
        
      case 'traffic-sources':
        const cacheKey = `ga_traffic_sources_${period}`;
        result = {
          data: await cachedApiCall(
            cacheKey,
            () => connector.getTrafficSources(timeRange),
            {
              ttl: 10 * 60 * 1000, // 10 minutes cache
              timeout: 20000, // 20 second timeout
              fallbackData: [
                { source: 'google', medium: 'organic', campaign: '', sessions: 0, users: 0, conversions: 0 },
                { source: 'direct', medium: '(none)', campaign: '', sessions: 0, users: 0, conversions: 0 },
              ],
            }
          ),
          cached: performanceCache.has(cacheKey),
        };
        break;
        
      case 'conversions-by-day':
        result = await withCache(
          `ga_conversions_${period}`,
          () => connector.getConversionsByDay(timeRange)
        );
        break;
        
      case 'devices':
        result = await withCache(
          `ga_devices_${period}`,
          () => connector.getDeviceData(timeRange)
        );
        break;
        
      case 'daily':
        // Daily traffic data for chart - actual daily breakdown
        result = await withCache(
          `ga_daily_${period}`,
          () => connector.getSessionsByDay(timeRange)
        );
        break;
        
      case 'top-pages':
        // Top 5 pages by pageviews
        result = await withCache(
          `ga_top_pages_${period}`,
          () => connector.getTopPages(timeRange)
        );
        break;
        
      default:
        throw new Error(`Unknown report type: ${report}`);
    }

    const response: ApiResponse<any> = {
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
      cached: result.cached,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Google Analytics API error:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch Google Analytics data',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, { status: 500 });
  }
}