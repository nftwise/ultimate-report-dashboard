import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsConnector } from '@/lib/google-ads';
import { getTimeRangeDates } from '@/lib/utils';
import { ApiResponse } from '@/types';
import { getClientConfig } from '@/lib/server-utils';
import { cachedApiCall } from '@/lib/performance-cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const report = searchParams.get('report') || searchParams.get('type') || 'campaigns';
    const clientId = searchParams.get('clientId');
    const timeRange = getTimeRangeDates(period);

    // Get client-specific configuration
    let clientConfig = null;
    let customerId = undefined;
    let mccId = undefined;

    if (clientId) {
      clientConfig = await getClientConfig(clientId);
      customerId = clientConfig?.googleAdsCustomerId;
      mccId = clientConfig?.googleAdsMccId;
    }

    const connector = new GoogleAdsConnector();

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
        result = {
          data: await cachedApiCall(
            `gads_campaigns_${period}_${clientId || 'default'}`,
            () => connector.getCampaignReport(timeRange, customerId, mccId),
            {
              ttl: 10 * 60 * 1000, // 10 minutes cache
              timeout: 5000, // 5 second timeout
              fallbackData: fallbackCampaignData,
            }
          ),
          cached: false,
        };
        break;

      case 'phone-calls':
        result = {
          data: await cachedApiCall(
            `gads_phone_calls_${period}_${clientId || 'default'}`,
            () => connector.getPhoneCallConversions(timeRange, customerId, mccId),
            {
              ttl: 10 * 60 * 1000,
              timeout: 5000,
              fallbackData: [],
            }
          ),
          cached: false,
        };
        break;

      case 'cost-per-lead':
        result = {
          data: await cachedApiCall(
            `gads_cpl_${period}_${clientId || 'default'}`,
            () => connector.getCostPerLeadData(timeRange, customerId, mccId),
            {
              ttl: 10 * 60 * 1000,
              timeout: 5000,
              fallbackData: [],
            }
          ),
          cached: false,
        };
        break;

      case 'overview':
        result = {
          data: await cachedApiCall(
            `gads_overview_${period}_${clientId || 'default'}`,
            () => connector.getCampaignReport(timeRange, customerId, mccId),
            {
              ttl: 10 * 60 * 1000,
              timeout: 5000,
              fallbackData: fallbackCampaignData,
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

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch Google Ads data',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
