import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { withCache, cacheKeys } from '@/lib/cache';
import { getTimeRangeDates } from '@/lib/utils';
import { ApiResponse } from '@/types';
import { cachedApiCall, performanceCache } from '@/lib/performance-cache';
import clientsData from '@/data/clients.json';
import { getCachedOrFetch, generateCacheKey } from '@/lib/smart-cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const report = searchParams.get('report') || searchParams.get('type') || 'basic';
    const clientId = searchParams.get('clientId');
    const forceFresh = searchParams.get('forceFresh') === 'true'; // Skip cache

    // Check for custom date range params first, otherwise use period
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const timeRange = (customStartDate && customEndDate)
      ? { startDate: customStartDate, endDate: customEndDate, period: 'custom' as any }
      : getTimeRangeDates(period);

    // Get client-specific property ID
    let propertyId: string | undefined;
    if (clientId) {
      const clients = (clientsData as any).clients || [];
      const client = clients.find((c: any) => c.id === clientId);
      if (client?.googleAnalyticsPropertyId) {
        propertyId = client.googleAnalyticsPropertyId;
        console.log(`[GA API] Using propertyId ${propertyId} for client ${clientId}`);
      } else {
        console.log(`[GA API] No propertyId found for client ${clientId}`);
      }
    } else {
      console.log('[GA API] No clientId provided, using default property');
    }

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
          throw new Error(`Google Analytics API configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
        
      case 'basic':
        const basicCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'basic',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            basicCacheKey,
            () => connector.getBasicMetrics(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'traffic-sources':
        const trafficCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'traffic-sources',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            trafficCacheKey,
            () => connector.getTrafficSources(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'conversions-by-day':
        const conversionsCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'conversions-by-day',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            conversionsCacheKey,
            () => connector.getConversionsByDay(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'devices':
        const devicesCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'devices',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            devicesCacheKey,
            () => connector.getDeviceData(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'daily':
        // Daily traffic data for chart - actual daily breakdown
        const dailyCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'daily',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            dailyCacheKey,
            () => connector.getSessionsByDay(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'top-pages':
        // Top 5 pages by pageviews
        const topPagesCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'top-pages',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            topPagesCacheKey,
            () => connector.getTopPages(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
        break;

      case 'ai-traffic':
        // AI and emerging traffic sources
        const aiTrafficCacheKey = generateCacheKey('google_analytics', clientId || 'default', {
          report: 'ai-traffic',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            aiTrafficCacheKey,
            () => connector.getAITrafficSources(timeRange, propertyId),
            {
              source: 'google_analytics',
              clientId: clientId || undefined,
              dateRange: {
                startDate: timeRange.startDate,
                endDate: timeRange.endDate
              },
              forceFresh
            }
          ),
          cached: false,
        };
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