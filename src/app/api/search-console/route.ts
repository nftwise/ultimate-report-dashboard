import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import { getCachedOrFetch, generateCacheKey } from '@/lib/smart-cache';
import { supabaseAdmin } from '@/lib/supabase';

interface ClientConfig {
  id: string;
  searchConsoleSiteUrl: string;
}

const getAuthClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials');
  }

  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
};

// Make direct API request to Search Console API
async function makeSearchConsoleRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  // Always use service account credentials
  const auth = getAuthClient();
  const tokenResponse = await auth.getAccessToken();
  const token = tokenResponse.token || '';

  const url = `https://www.googleapis.com/webmasters/v3${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search Console API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Get client config from Supabase database
// Supports both UUID (client_id) and slug lookups
const getClientConfig = async (clientId: string): Promise<ClientConfig | null> => {
  try {
    // Check if clientId is a UUID (contains dashes and is 36 chars)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);

    let data;
    let error;

    if (isUUID) {
      // Direct lookup by client_id
      const result = await supabaseAdmin
        .from('service_configs')
        .select('client_id, gsc_site_url')
        .eq('client_id', clientId)
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Lookup by slug - need to join with clients table
      const result = await supabaseAdmin
        .from('clients')
        .select(`
          id,
          slug,
          service_configs (
            gsc_site_url
          )
        `)
        .eq('slug', clientId)
        .single();

      if (result.data) {
        const config = Array.isArray(result.data.service_configs)
          ? result.data.service_configs[0]
          : result.data.service_configs;
        data = {
          client_id: result.data.id,
          gsc_site_url: config?.gsc_site_url || ''
        };
      }
      error = result.error;
    }

    if (error || !data) {
      console.error('Error fetching client config:', error);
      return null;
    }

    return {
      id: data.client_id,
      searchConsoleSiteUrl: data.gsc_site_url || ''
    };
  } catch (error) {
    console.error('Error fetching client config:', error);
    return null;
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const clientId = searchParams.get('clientId');
    const type = searchParams.get('type') || 'performance';
    const forceFresh = searchParams.get('forceFresh') === 'true'; // Skip cache

    // Note: Using service account credentials for all API calls

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const clientConfig = await getClientConfig(clientId);
    console.log('[SearchConsole] Client config for', clientId, ':', clientConfig ? { hasGsc: !!clientConfig.searchConsoleSiteUrl } : 'null');

    if (!clientConfig || !clientConfig.searchConsoleSiteUrl) {
      console.log('[SearchConsole] No GSC URL configured for client:', clientId);
      return NextResponse.json({
        success: false,
        error: 'Search Console URL not configured for this client',
        message: 'Please configure the GSC Site URL in the admin panel'
      }, { status: 404 });
    }

    const siteUrl = clientConfig.searchConsoleSiteUrl;
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    if (type === 'status') {
      // Just check if API is working
      try {
        await makeSearchConsoleRequest('/sites', 'GET', undefined);
        return NextResponse.json({ success: true, message: 'Search Console API connected' });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Search Console API connection failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (type === 'performance') {
      const performanceCacheKey = generateCacheKey('search_console', clientId, {
        type: 'performance',
        period,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });

      const data = await getCachedOrFetch(
        performanceCacheKey,
        async () => {
          // Get search performance data
          const response = await makeSearchConsoleRequest(
            `/sites/${encodedSiteUrl}/searchAnalytics/query`,
            'POST',
            {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              dimensions: ['date'],
              rowLimit: 1000
            }
          );

          const performanceData = response.rows?.map((row: any) => ({
            date: row.keys[0],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
          })) || [];

          return {
            performance: performanceData,
            totals: {
              clicks: performanceData.reduce((sum: number, item: any) => sum + item.clicks, 0),
              impressions: performanceData.reduce((sum: number, item: any) => sum + item.impressions, 0),
              avgCtr: performanceData.length > 0 ?
                performanceData.reduce((sum: number, item: any) => sum + item.ctr, 0) / performanceData.length : 0,
              avgPosition: performanceData.length > 0 ?
                performanceData.reduce((sum: number, item: any) => sum + item.position, 0) / performanceData.length : 0
            }
          };
        },
        {
          source: 'search_console',
          clientId,
          dateRange: {
            startDate: formattedStartDate,
            endDate: formattedEndDate
          },
          forceFresh
        }
      );

      return NextResponse.json({
        success: true,
        data
      });
    }

    if (type === 'queries') {
      const queriesCacheKey = generateCacheKey('search_console', clientId, {
        type: 'queries',
        period,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });

      const data = await getCachedOrFetch(
        queriesCacheKey,
        async () => {
          // Get top search queries (increased limit to capture more keywords)
          const response = await makeSearchConsoleRequest(
            `/sites/${encodedSiteUrl}/searchAnalytics/query`,
            'POST',
            {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              dimensions: ['query'],
              rowLimit: 1000
            }
          );

          const queries = response.rows?.map((row: any) => ({
            query: row.keys[0],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
          })) || [];

          return { queries };
        },
        {
          source: 'search_console',
          clientId,
          dateRange: {
            startDate: formattedStartDate,
            endDate: formattedEndDate
          },
          forceFresh
        }
      );

      return NextResponse.json({
        success: true,
        data
      });
    }

    if (type === 'pages') {
      const pagesCacheKey = generateCacheKey('search_console', clientId, {
        type: 'pages',
        period,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });

      const data = await getCachedOrFetch(
        pagesCacheKey,
        async () => {
          // Get top performing pages
          const response = await makeSearchConsoleRequest(
            `/sites/${encodedSiteUrl}/searchAnalytics/query`,
            'POST',
            {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              dimensions: ['page'],
              rowLimit: 20
            }
          );

          const pages = response.rows?.map((row: any) => ({
            page: row.keys[0],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
          })) || [];

          return { pages };
        },
        {
          source: 'search_console',
          clientId,
          dateRange: {
            startDate: formattedStartDate,
            endDate: formattedEndDate
          },
          forceFresh
        }
      );

      return NextResponse.json({
        success: true,
        data
      });
    }

    if (type === 'competitive-analysis') {
      const competitiveCacheKey = generateCacheKey('search_console', clientId, {
        type: 'competitive-analysis',
        period,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });

      const data = await getCachedOrFetch(
        competitiveCacheKey,
        async () => {
          // Get ranking changes and competitive metrics
          // Current period data
          const currentResponse = await makeSearchConsoleRequest(
            `/sites/${encodedSiteUrl}/searchAnalytics/query`,
            'POST',
            {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              dimensions: ['query'],
              rowLimit: 50
            }
          );

          // Previous period data for comparison
          const previousEndDate = new Date(startDate);
          previousEndDate.setDate(previousEndDate.getDate() - 1);
          const previousStartDate = new Date(previousEndDate);
          previousStartDate.setDate(previousStartDate.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          const previousResponse = await makeSearchConsoleRequest(
            `/sites/${encodedSiteUrl}/searchAnalytics/query`,
            'POST',
            {
              startDate: previousStartDate.toISOString().split('T')[0],
              endDate: previousEndDate.toISOString().split('T')[0],
              dimensions: ['query'],
              rowLimit: 50
            }
          );

          const currentQueries = new Map<string, { position: number; clicks: number; impressions: number; ctr: number }>(
            currentResponse.rows?.map((row: any) => [
              row.keys[0],
              { position: row.position, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr }
            ]) || []
          );

          const previousQueries = new Map<string, { position: number }>(
            previousResponse.rows?.map((row: any) => [
              row.keys[0],
              { position: row.position }
            ]) || []
          );

          // Calculate ranking changes
          const rankings = Array.from(currentQueries.entries())
            .map(([query, data]) => {
              const previousData = previousQueries.get(query);
              const previousPosition = (previousData?.position ?? 0);
              const change = previousPosition > 0 ? previousPosition - data.position : 0;
              return {
                query,
                currentPosition: Math.round(data.position),
                previousPosition: Math.round(previousPosition),
                impressions: data.impressions,
                clicks: data.clicks,
                ctr: data.ctr,
                change: Math.round(change * 10) / 10,
                trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable'
              };
            })
            .filter(r => r.currentPosition <= 30) // Only show positions 1-30
            .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)); // Sort by biggest changes

          // Calculate metrics
          const allImpressions = Array.from(currentQueries.values()).reduce((sum, q) => sum + q.impressions, 0);
          const topPositions = rankings.filter(r => r.currentPosition <= 3).length;
          const avgPosition = Array.from(currentQueries.values()).reduce((sum, q) => sum + q.position, 0) / currentQueries.size;
          const previousAvgPosition = Array.from(previousQueries.values()).reduce((sum, q) => sum + q.position, 0) / previousQueries.size;

          // Estimate market share (simplified calculation)
          const marketShare = topPositions > 0 ? Math.min((topPositions / 10) * 100, 100) : 0;

          // Calculate visibility score (0-100 based on positions and impressions)
          const visibilityScore = Math.min(
            Math.round((topPositions * 10) + (rankings.filter(r => r.currentPosition <= 10).length * 5) +
            (allImpressions / 1000)),
            100
          );

          // Estimate competitors beaten (simplified)
          const beatCompetitors = Math.floor(topPositions * 0.8);

          return {
            rankings: rankings.slice(0, 15), // Top 15 ranking changes
            metrics: {
              averagePosition: Math.round(avgPosition * 10) / 10,
              previousAveragePosition: Math.round(previousAvgPosition * 10) / 10,
              topPositions,
              marketShare: Math.round(marketShare * 10) / 10,
              visibilityScore,
              beatCompetitors
            }
          };
        },
        {
          source: 'search_console',
          clientId,
          dateRange: {
            startDate: formattedStartDate,
            endDate: formattedEndDate
          },
          forceFresh
        }
      );

      return NextResponse.json({
        success: true,
        data
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });

  } catch (error: any) {
    console.error('Search Console API Error:', error);

    // Check if it's a permission error
    const isPermissionError = error.message?.includes('403') ||
                              error.message?.includes('forbidden') ||
                              error.message?.includes('permission');

    // Check if it's an auth error
    const isAuthError = error.message?.includes('401') ||
                        error.message?.includes('unauthorized') ||
                        error.message?.includes('invalid_grant');

    if (isPermissionError || isAuthError) {
      return NextResponse.json({
        success: false,
        error: 'Search Console access not authorized',
        message: 'The service account does not have access to this Search Console property. Please add the service account as a user in Search Console.',
        details: error.message || 'Unknown error'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: 'Search Console API request failed',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
