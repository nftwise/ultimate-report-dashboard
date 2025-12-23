import { NextRequest, NextResponse } from 'next/server';
import { getClientConfig } from '@/lib/server-utils';

/**
 * Get client configuration (non-sensitive fields only)
 * Used by dashboard to check which services are active
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    const clientConfig = await getClientConfig(clientId);

    if (!clientConfig) {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 });
    }

    // Return only non-sensitive configuration
    // Check which services are active by checking if IDs are present
    const config = {
      id: clientConfig.uuid || clientConfig.id,  // Use UUID if available, fallback to slug for backwards compatibility
      companyName: clientConfig.companyName,
      owner: clientConfig.owner || '',
      city: clientConfig.city || '',
      services: {
        googleAnalytics: !!(clientConfig.googleAnalyticsPropertyId && clientConfig.googleAnalyticsPropertyId.trim() !== ''),
        googleAds: !!(clientConfig.googleAdsCustomerId && clientConfig.googleAdsCustomerId.trim() !== ''),
        searchConsole: !!(clientConfig.searchConsoleSiteUrl && clientConfig.searchConsoleSiteUrl.trim() !== ''),
        callRail: !!(clientConfig.callrailAccountId && clientConfig.callrailAccountId.trim() !== ''),
      }
    };

    // Also return GBP location ID if available (for backwards compatibility with fetchGBPLocationId)
    const data: any = {};
    if (clientConfig.gbpLocationId) {
      data.gbpLocationId = clientConfig.gbpLocationId;
    }

    return NextResponse.json({
      success: true,
      config,
      data  // For backwards compatibility
    });

  } catch (error) {
    console.error('Error fetching client config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch client configuration'
    }, { status: 500 });
  }
}
