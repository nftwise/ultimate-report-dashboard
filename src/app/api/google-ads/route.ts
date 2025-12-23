import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsUnifiedConnector, createGoogleAdsConnector } from '@/lib/google-ads-unified';
import { getTimeRangeDates } from '@/lib/utils';
import { ApiResponse } from '@/types';
import { getClientConfig } from '@/lib/server-utils';
import { cachedApiCall } from '@/lib/performance-cache';
import { getCachedOrFetch, generateCacheKey } from '@/lib/smart-cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const report = searchParams.get('report') || searchParams.get('type') || 'campaigns';
    const clientId = searchParams.get('clientId');
    const forceFresh = searchParams.get('forceFresh') === 'true'; // Skip cache

    // Check for custom date range params first, otherwise use period
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const timeRange = (customStartDate && customEndDate)
      ? { startDate: customStartDate, endDate: customEndDate, period: 'custom' as any }
      : getTimeRangeDates(period);

    // Get client-specific configuration
    let clientConfig = null;
    let customerId = undefined;
    let mccId = undefined;

    if (clientId) {
      clientConfig = await getClientConfig(clientId);
      customerId = clientConfig?.googleAdsCustomerId;
      mccId = clientConfig?.googleAdsMccId;
    }

    // Get session to pass access token if available
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string } } | null;
    const accessToken = session?.user?.accessToken;

    // Use unified connector with automatic fallback
    const connector = createGoogleAdsConnector(accessToken);

    // Fallback data structure for error cases - returns empty/zero values
    const fallbackCampaignData = {
      campaigns: [],
      adGroups: [],
      keywords: [],
      totalMetrics: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cost: 0,
        conversions: 0,
        conversionRate: 0,
        costPerConversion: 0,
        phoneCallConversions: 0,
        costPerLead: 0,
        qualityScore: 0,
        searchImpressionShare: 0,
      },
      dateRange: timeRange,
    };

    let result;

    switch (report) {
      case 'status':
        // Simple status check - try to initialize connector and check credentials
        try {
          if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
              !process.env.GOOGLE_ADS_CLIENT_ID ||
              !process.env.GOOGLE_ADS_CLIENT_SECRET ||
              !process.env.GOOGLE_ADS_REFRESH_TOKEN) {
            throw new Error('Missing Google Ads API credentials');
          }
          result = { data: { status: 'connected' }, cached: false };
        } catch (error) {
          throw new Error(`Google Ads API configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;

      case 'campaigns':
        const campaignCacheKey = generateCacheKey('google_ads', clientId || 'default', {
          report: 'campaigns',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            campaignCacheKey,
            () => connector.getCampaignReport(timeRange, customerId, mccId),
            {
              source: 'google_ads',
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

      case 'phone-calls':
        const phoneCallsCacheKey = generateCacheKey('google_ads', clientId || 'default', {
          report: 'phone-calls',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            phoneCallsCacheKey,
            () => connector.getPhoneCallConversions(timeRange, customerId, mccId),
            {
              source: 'google_ads',
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

      case 'cost-per-lead':
        const cplCacheKey = generateCacheKey('google_ads', clientId || 'default', {
          report: 'cost-per-lead',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            cplCacheKey,
            () => connector.getCostPerLeadData(timeRange, customerId, mccId),
            {
              source: 'google_ads',
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

      case 'overview':
        const overviewCacheKey = generateCacheKey('google_ads', clientId || 'default', {
          report: 'overview',
          period,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate
        });

        result = {
          data: await getCachedOrFetch(
            overviewCacheKey,
            () => connector.getCampaignReport(timeRange, customerId, mccId),
            {
              source: 'google_ads',
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
    console.error('Google Ads API error:', error);

    // Get detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('Detailed error:', {
      message: errorMessage,
      stack: errorStack,
      customerId: request.nextUrl.searchParams.get('clientId'),
      envVars: {
        hasDevToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        hasClientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
        hasRefreshToken: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
        hasMccId: !!process.env.GOOGLE_ADS_MCC_ID,
      }
    });

    const response: ApiResponse<null> = {
      success: false,
      error: `Failed to fetch Google Ads data: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
