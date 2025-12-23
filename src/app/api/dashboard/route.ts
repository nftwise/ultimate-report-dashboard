import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { GoogleAdsServiceAccountConnector } from '@/lib/google-ads-service-account';
import { CallRailConnector } from '@/lib/callrail';
import { withCache, cacheKeys } from '@/lib/cache';
import { getTimeRangeDates, getPreviousPeriodDates, calculatePercentageChange } from '@/lib/utils';
import { getClientConfig } from '@/lib/server-utils';
import { DashboardMetrics, ApiResponse } from '@/types';
import { parallelApiCalls } from '@/lib/performance-cache';
import { fastCache, getParallelFast } from '@/lib/fast-cache';
import { supabaseAdmin } from '@/lib/supabase';

// Fast timeout for API calls (fail fast, don't block UI)
const API_TIMEOUT = 8000; // 8 seconds max per API

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const clientId = searchParams.get('clientId');

    console.log('========================================');
    console.log('[Dashboard] NEW REQUEST');
    console.log('[Dashboard] Period:', period);
    console.log('[Dashboard] Client ID:', clientId);
    console.log('========================================');

    // Note: Using service account credentials for all API calls

    // Support custom date ranges for period comparisons
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('📅 [Dashboard API] Received date params - startDate:', startDate, 'endDate:', endDate);

    const timeRange = (startDate && endDate)
      ? { startDate, endDate, period: 'custom' as const }
      : getTimeRangeDates(period);

    console.log('📊 [Dashboard API] Final timeRange being used:', timeRange);

    // Get client config from database (Supabase)
    let clientConfig = null;
    if (clientId) {
      // Check if clientId is UUID or slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);

      let serviceConfig;
      if (isUUID) {
        const { data } = await supabaseAdmin
          .from('service_configs')
          .select('ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id')
          .eq('client_id', clientId)
          .single();
        serviceConfig = data;
      } else {
        // Look up by slug
        const { data: clientData } = await supabaseAdmin
          .from('clients')
          .select(`
            id,
            service_configs (
              ga_property_id,
              gads_customer_id,
              gsc_site_url,
              gbp_location_id
            )
          `)
          .eq('slug', clientId)
          .single();

        if (clientData?.service_configs) {
          serviceConfig = Array.isArray(clientData.service_configs)
            ? clientData.service_configs[0]
            : clientData.service_configs;
        }
      }

      console.log('[Dashboard API] Client ID requested:', clientId);
      console.log('[Dashboard API] Service config found:', !!serviceConfig);

      if (serviceConfig) {
        clientConfig = {
          gaPropertyId: serviceConfig.ga_property_id,
          adsCustomerId: serviceConfig.gads_customer_id,
          adsMccId: process.env.GOOGLE_ADS_MCC_ID || '8432700368', // Use env var for MCC
          callrailAccountId: '', // CallRail not in service_configs yet
        };
        console.log('[Dashboard API] Client config from DB:', {
          gaPropertyId: clientConfig.gaPropertyId,
          hasAds: !!clientConfig.adsCustomerId,
          hasCallRail: !!clientConfig.callrailAccountId
        });
      } else {
        console.log('[Dashboard API] WARNING: Client not found in database!');
      }
    } else {
      console.log('[Dashboard API] No clientId parameter provided');
    }

    // Use fast in-memory cache (instant lookup)
    const cacheKey = `dashboard-${clientId || 'default'}-${timeRange.startDate}-${timeRange.endDate}`;
    const forceFresh = searchParams.get('forceFresh') === 'true';

    // Check fast cache first (< 1ms)
    if (!forceFresh) {
      const cached = fastCache.get<DashboardMetrics>(cacheKey);
      if (cached) {
        console.log(`⚡ [Dashboard] Fast cache HIT for ${cacheKey}`);
        return NextResponse.json({
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
        });
      }
    }

    console.log(`🔄 [Dashboard] Cache miss, fetching data...`);
    const fetchStartTime = Date.now();

    // Fetch fresh data
    const result = await (async () => {
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
          gaData: async () => {
            if (!clientConfig?.gaPropertyId) {
              console.log('[Dashboard API] No GA Property ID, using fallback');
              return gaFallback;
            }
            console.log('[Dashboard API] Calling GA API with propertyId:', clientConfig.gaPropertyId);
            try {
              const result = await new GoogleAnalyticsConnector(clientId || undefined).getBasicMetrics(timeRange, clientConfig.gaPropertyId);
              console.log('[Dashboard API] GA API SUCCESS! Sessions:', result?.metrics?.sessions || 0);
              return result;
            } catch (error: any) {
              console.error('[Dashboard API] GA API ERROR:', error.message);
              return gaFallback;
            }
          },
          gaEvents: () => clientConfig?.gaPropertyId
            ? new GoogleAnalyticsConnector(clientId || undefined).getEventCounts(timeRange, clientConfig.gaPropertyId)
            : Promise.resolve({ formSubmissions: 0, phoneCalls: 0, clickToChat: 0 }),
          callRailData: () => clientConfig?.callrailAccountId
            ? new CallRailConnector().getCallsReport(timeRange, clientConfig.callrailAccountId)
            : Promise.resolve(callRailFallback),
          // Google Ads API using direct REST API (v20)
          adsData: async () => {
            if (!clientConfig?.adsCustomerId) {
              return adsFallback;
            }

            try {
              console.log('[Dashboard API] Calling Google Ads API (Service Account)');
              const result = await new GoogleAdsServiceAccountConnector().getCampaignReport(
                timeRange,
                clientConfig.adsCustomerId,
                clientConfig.adsMccId
              );
              console.log('[Dashboard] Google Ads API SUCCESS - Real Data!');
              console.log('[Dashboard] Total Cost:', result?.totalMetrics?.cost || 0);
              console.log('[Dashboard] Campaigns:', result?.campaigns?.length || 0);
              return result;
            } catch (error: any) {
              console.error('[Dashboard] Google Ads API Error:', error.message);
              console.error('[Dashboard] Full error:', error);
              console.log('[Dashboard] Returning empty data - API failed');
              // Return empty data so user knows it's not working
              return adsFallback;
            }
          }
        };

        const results = await parallelApiCalls(apiCalls, {
          timeout: API_TIMEOUT, // 8 second timeout per API call (fail fast)
          continueOnError: true
        });

        console.log('[Dashboard] Parallel API calls completed');
        console.log('[Dashboard] GA Data received:', !!results.gaData);
        console.log('[Dashboard] GA Sessions:', results.gaData?.metrics?.sessions || 0);
        console.log('[Dashboard] Ads Data received:', !!results.adsData);
        console.log('[Dashboard] Ads Cost:', results.adsData?.totalMetrics?.cost || 0);

        const gaData = results.gaData || gaFallback;
        const gaEvents = results.gaEvents || { formSubmissions: 0, phoneCalls: 0, clickToChat: 0 };
        const adsData = results.adsData || adsFallback;
        const callRailData = results.callRailData || callRailFallback;

        const dashboardMetrics: DashboardMetrics = {
          googleAnalytics: gaData || gaFallback,
          googleAds: adsData || adsFallback,
          callRail: callRailData || callRailFallback,
          gaEvents: gaEvents, // Add GA4 events
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
          totalPhoneCalls: adsMetrics.phoneCallConversions, // Only Google Ads phone call conversions
          totalConversions: adsMetrics.conversions, // Only Google Ads conversions
          overallCostPerLead: adsMetrics.conversions > 0
            ? adsMetrics.cost / adsMetrics.conversions
            : 0,
          overallROI: calculateROI(gaMetrics.ecommerce?.revenue || 0, adsMetrics.cost),
          phoneCallConversionRate: callMetrics.conversionRate,
          attributedPhoneCalls: adsMetrics.phoneCallConversions, // Only Google Ads phone call conversions
        };

        // Fetch previous period data for comparison
        console.log('[Dashboard] Fetching previous period data for comparison...');
        const previousTimeRange = getPreviousPeriodDates(timeRange.startDate, timeRange.endDate);
        console.log('[Dashboard] Previous period:', previousTimeRange.startDate, 'to', previousTimeRange.endDate);

        try {
          const previousApiCalls = {
            prevGaData: async () => {
              if (!clientConfig?.gaPropertyId) return gaFallback;
              try {
                return await new GoogleAnalyticsConnector(clientId || undefined).getBasicMetrics(previousTimeRange, clientConfig.gaPropertyId);
              } catch (error) {
                console.error('[Dashboard] Previous GA API error:', error);
                return gaFallback;
              }
            },
            prevAdsData: async () => {
              if (!clientConfig?.adsCustomerId) return adsFallback;
              try {
                return await new GoogleAdsServiceAccountConnector().getCampaignReport(
                  previousTimeRange,
                  clientConfig.adsCustomerId,
                  clientConfig.adsMccId
                );
              } catch (error) {
                console.error('[Dashboard] Previous Ads API error:', error);
                return adsFallback;
              }
            },
            prevCallRailData: async () => {
              if (!clientConfig?.callrailAccountId) return callRailFallback;
              try {
                return await new CallRailConnector().getCallsReport(previousTimeRange, clientConfig.callrailAccountId);
              } catch (error) {
                console.error('[Dashboard] Previous CallRail API error:', error);
                return callRailFallback;
              }
            }
          };

          const previousResults = await parallelApiCalls(previousApiCalls, {
            timeout: API_TIMEOUT, // 8 second timeout (fail fast)
            continueOnError: true
          });

          const prevGaMetrics = previousResults.prevGaData?.metrics || gaFallback.metrics;
          const prevAdsMetrics = previousResults.prevAdsData?.totalMetrics || adsFallback.totalMetrics;
          const prevCallMetrics = previousResults.prevCallRailData?.metrics || callRailFallback.metrics;

          // Calculate current period totals
          const currentTraffic = gaMetrics.sessions;
          const currentLeads = adsMetrics.conversions;
          const currentPhoneCalls = adsMetrics.phoneCallConversions; // Only Google Ads phone calls
          const currentSpend = adsMetrics.cost;
          const currentCpl = adsMetrics.costPerLead;

          // Calculate previous period totals
          const prevTraffic = prevGaMetrics.sessions;
          const prevLeads = prevAdsMetrics.conversions;
          const prevPhoneCalls = prevAdsMetrics.phoneCallConversions; // Only Google Ads phone calls
          const prevSpend = prevAdsMetrics.cost;
          const prevCpl = prevAdsMetrics.costPerLead;

          console.log('[Dashboard] Current period - Traffic:', currentTraffic, 'Leads:', currentLeads, 'Phone Calls:', currentPhoneCalls);
          console.log('[Dashboard] Previous period - Traffic:', prevTraffic, 'Leads:', prevLeads, 'Phone Calls:', prevPhoneCalls);

          // Calculate percentage changes
          dashboardMetrics.comparison = {
            trafficChange: calculatePercentageChange(currentTraffic, prevTraffic),
            leadsChange: calculatePercentageChange(currentLeads, prevLeads),
            phoneCallsChange: calculatePercentageChange(currentPhoneCalls, prevPhoneCalls),
            spendChange: calculatePercentageChange(currentSpend, prevSpend),
            cplChange: calculatePercentageChange(currentCpl, prevCpl)
          };

          console.log('[Dashboard] Percentage changes calculated:', dashboardMetrics.comparison);
        } catch (error) {
          console.error('[Dashboard] Error calculating comparisons:', error);
          // Set default values if comparison fails
          dashboardMetrics.comparison = {
            trafficChange: 0,
            leadsChange: 0,
            phoneCallsChange: 0,
            spendChange: 0,
            cplChange: 0
          };
        }

        return dashboardMetrics;
      })();

    // Store in fast cache (5 min TTL for current data, 1 hour for historical)
    const isHistorical = new Date(timeRange.endDate) < new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cacheTTL = isHistorical ? 3600 : 300; // 1 hour for historical, 5 min for current
    fastCache.set(cacheKey, result, cacheTTL);

    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`✅ [Dashboard] Data fetched in ${fetchDuration}ms, cached for ${cacheTTL}s`);

    const response: ApiResponse<DashboardMetrics> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

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