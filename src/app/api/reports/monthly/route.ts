import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { GoogleAdsDirectConnector } from '@/lib/google-ads-direct';
import { TimeRange } from '@/types';
import fs from 'fs';
import path from 'path';

interface Client {
  id: string;
  companyName: string;
  googleAdsCustomerId?: string;
  googleAdsMccId?: string;
}

const getClient = (clientId: string): Client | null => {
  try {
    const clientsPath = path.join(process.cwd(), 'src', 'data', 'clients.json');
    const clientsData = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    return clientsData.clients.find((client: Client) => client.id === clientId) || null;
  } catch (error) {
    console.error('Error reading clients data:', error);
    return null;
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = getClient(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get current date (Oct 15, 2025)
    const today = new Date('2025-10-15');

    // September 2025: Sept 1 - Sept 30 (full month)
    const septStart = '2025-09-01';
    const septEnd = '2025-09-30';

    // October 2025: Oct 1 - Oct 15 (partial month, same number of days for fair comparison)
    const octStart = '2025-10-01';
    const octEnd = '2025-10-15';

    // For fair comparison: Compare first 15 days of each month
    const septStart15 = '2025-09-01';
    const septEnd15 = '2025-09-15';

    const septRange: TimeRange = {
      startDate: septStart15,
      endDate: septEnd15,
      period: 'custom' as const
    };

    const octRange: TimeRange = {
      startDate: octStart,
      endDate: octEnd,
      period: 'custom' as const
    };

    const gaConnector = new GoogleAnalyticsConnector();
    const adsConnector = new GoogleAdsDirectConnector();

    console.log('[Monthly Report] Fetching September data:', septRange);
    console.log('[Monthly Report] Fetching October data:', octRange);

    // Fetch data for both months
    const [septGA, septAds, octGA, octAds] = await Promise.all([
      gaConnector.getBasicMetrics(septRange).catch((e) => {
        console.error('[Monthly Report] Sept GA error:', e.message);
        return { metrics: { sessions: 0, users: 0, conversions: 0, bounceRate: 0 } };
      }),
      adsConnector.getCampaignReport(
        septRange,
        client.googleAdsCustomerId,
        client.googleAdsMccId
      ).catch((e) => {
        console.error('[Monthly Report] Sept Ads error:', e.message);
        return { campaigns: [], totalMetrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } };
      }),
      gaConnector.getBasicMetrics(octRange).catch((e) => {
        console.error('[Monthly Report] Oct GA error:', e.message);
        return { metrics: { sessions: 0, users: 0, conversions: 0, bounceRate: 0 } };
      }),
      adsConnector.getCampaignReport(
        octRange,
        client.googleAdsCustomerId,
        client.googleAdsMccId
      ).catch((e) => {
        console.error('[Monthly Report] Oct Ads error:', e.message);
        return { campaigns: [], totalMetrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } };
      })
    ]);

    // Calculate changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const report = {
      comparisonPeriod: {
        september: { start: septStart15, end: septEnd15, label: 'Sept 1-15' },
        october: { start: octStart, end: octEnd, label: 'Oct 1-15' }
      },
      googleAds: {
        september: {
          spend: septAds.totalMetrics?.cost || 0,
          clicks: septAds.totalMetrics?.clicks || 0,
          impressions: septAds.totalMetrics?.impressions || 0,
          conversions: septAds.totalMetrics?.conversions || 0,
          cpc: septAds.totalMetrics?.cpc || 0,
          costPerConversion: septAds.totalMetrics?.costPerConversion || 0,
          conversionRate: septAds.totalMetrics?.conversionRate || 0
        },
        october: {
          spend: octAds.totalMetrics?.cost || 0,
          clicks: octAds.totalMetrics?.clicks || 0,
          impressions: octAds.totalMetrics?.impressions || 0,
          conversions: octAds.totalMetrics?.conversions || 0,
          cpc: octAds.totalMetrics?.cpc || 0,
          costPerConversion: octAds.totalMetrics?.costPerConversion || 0,
          conversionRate: octAds.totalMetrics?.conversionRate || 0
        },
        changes: {
          spend: calculateChange(octAds.totalMetrics?.cost || 0, septAds.totalMetrics?.cost || 0),
          clicks: calculateChange(octAds.totalMetrics?.clicks || 0, septAds.totalMetrics?.clicks || 0),
          impressions: calculateChange(octAds.totalMetrics?.impressions || 0, septAds.totalMetrics?.impressions || 0),
          conversions: calculateChange(octAds.totalMetrics?.conversions || 0, septAds.totalMetrics?.conversions || 0),
          cpc: calculateChange(octAds.totalMetrics?.cpc || 0, septAds.totalMetrics?.cpc || 0),
          costPerConversion: calculateChange(octAds.totalMetrics?.costPerConversion || 0, septAds.totalMetrics?.costPerConversion || 0)
        }
      },
      analytics: {
        september: {
          sessions: septGA.metrics.sessions,
          users: septGA.metrics.users,
          conversions: septGA.metrics.conversions,
          bounceRate: septGA.metrics.bounceRate
        },
        october: {
          sessions: octGA.metrics.sessions,
          users: octGA.metrics.users,
          conversions: octGA.metrics.conversions,
          bounceRate: octGA.metrics.bounceRate
        },
        changes: {
          sessions: calculateChange(octGA.metrics.sessions, septGA.metrics.sessions),
          users: calculateChange(octGA.metrics.users, septGA.metrics.users),
          conversions: calculateChange(octGA.metrics.conversions, septGA.metrics.conversions),
          bounceRate: calculateChange(octGA.metrics.bounceRate, septGA.metrics.bounceRate)
        }
      },
      campaigns: {
        september: septAds.campaigns || [],
        october: octAds.campaigns || []
      }
    };

    return NextResponse.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Monthly Report] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
