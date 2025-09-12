import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { CallRailConnector } from '@/lib/callrail';
import { withCache, cacheKeys } from '@/lib/cache';
import { getTimeRangeDates } from '@/lib/utils';
import { getClientConfig } from '@/lib/server-utils';
import { DashboardMetrics, ApiResponse } from '@/types';
import { parallelApiCalls } from '@/lib/performance-cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const clientId = searchParams.get('clientId');
    const timeRange = getTimeRangeDates(period);

    // Get client data if clientId is provided
    let clientConfig = null;
    if (clientId) {
      const client = await getClientConfig(clientId);
      
      if (client) {
        clientConfig = {
          gaPropertyId: client.googleAnalyticsPropertyId,
          adsCustomerId: client.googleAdsCustomerId,
          callrailAccountId: client.callrailAccountId,
        };
      }
    }

    const cacheKey = clientId 
      ? `dashboard_${clientId}_${period}` 
      : cacheKeys.dashboard(timeRange, {});

    const result = await withCache(
      cacheKey,
      async () => {
        // Prepare fallback data
        const gaFallback = { 
          metrics: { sessions: 0, users: 0, pageviews: 0, bounceRate: 0, sessionDuration: 0, conversions: 0, goalCompletions: 0 }, 
          dimensions: [], 
          dateRange: timeRange 
        };
        const adsFallback = { 
          campaigns: [], adGroups: [], keywords: [], 
          totalMetrics: { impressions: 0, clicks: 0, ctr: 0, cpc: 0, cost: 0, conversions: 0, conversionRate: 0, costPerConversion: 0, phoneCallConversions: 0, costPerLead: 0, qualityScore: 0, searchImpressionShare: 0 }, 
          dateRange: timeRange 
        };
        const callRailFallback = { 
          calls: [], trackingNumbers: [], 
          metrics: { totalCalls: 0, answeredCalls: 0, missedCalls: 0, totalDuration: 0, averageDuration: 0, firstTimeCalls: 0, repeatCalls: 0, conversions: 0, conversionRate: 0, totalValue: 0, averageValue: 0 }, 
          dateRange: timeRange 
        };

        // Use optimized parallel API calls with timeout and error handling
        const apiCalls = {
          gaData: () => clientConfig?.gaPropertyId 
            ? new GoogleAnalyticsConnector().getBasicMetrics(timeRange, clientConfig.gaPropertyId)
            : Promise.resolve(gaFallback),
          callRailData: () => clientConfig?.callrailAccountId 
            ? new CallRailConnector().getCallsReport(timeRange, clientConfig.callrailAccountId)
            : Promise.resolve(callRailFallback),
          // Skip Google Ads for now due to authentication issues
          adsData: () => Promise.resolve(adsFallback)
        };

        const results = await parallelApiCalls(apiCalls, {
          timeout: 25000, // 25 second timeout per API call
          continueOnError: true
        });

        const gaData = results.gaData || gaFallback;
        const adsData = results.adsData || adsFallback;
        const callRailData = results.callRailData || callRailFallback;

        const dashboardMetrics: DashboardMetrics = {
          googleAnalytics: gaData || gaFallback,
          googleAds: adsData || adsFallback,
          callRail: callRailData || callRailFallback,
          combined: {
            totalTrafficSessions: 0,
            totalAdSpend: 0,
            totalPhoneCalls: 0,
            totalConversions: 0,
            overallCostPerLead: 0,
            overallROI: 0,
            phoneCallConversionRate: 0,
            attributedPhoneCalls: 0,
          },
        };

        // Calculate combined metrics
        const gaMetrics = dashboardMetrics.googleAnalytics.metrics;
        const adsMetrics = dashboardMetrics.googleAds.totalMetrics;
        const callMetrics = dashboardMetrics.callRail.metrics;

        dashboardMetrics.combined = {
          totalTrafficSessions: gaMetrics.sessions,
          totalAdSpend: adsMetrics.cost,
          totalPhoneCalls: callMetrics.totalCalls,
          totalConversions: gaMetrics.conversions + adsMetrics.conversions + callMetrics.conversions,
          overallCostPerLead: (gaMetrics.conversions + adsMetrics.conversions + callMetrics.conversions) > 0 
            ? adsMetrics.cost / (gaMetrics.conversions + adsMetrics.conversions + callMetrics.conversions) 
            : 0,
          overallROI: calculateROI(gaMetrics.ecommerce?.revenue || 0, adsMetrics.cost),
          phoneCallConversionRate: callMetrics.conversionRate,
          attributedPhoneCalls: adsMetrics.phoneCallConversions,
        };

        return dashboardMetrics;
      }
    );

    const response: ApiResponse<DashboardMetrics> = {
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
      cached: result.cached,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dashboard API error:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch dashboard data',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, { status: 500 });
  }
}

function calculateROI(revenue: number, cost: number): number {
  if (cost === 0) return 0;
  return ((revenue - cost) / cost) * 100;
}