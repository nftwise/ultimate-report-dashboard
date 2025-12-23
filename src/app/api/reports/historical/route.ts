import { NextRequest, NextResponse } from 'next/server';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { GoogleAdsServiceAccountConnector } from '@/lib/google-ads-service-account';
import { TimeRange } from '@/types';
import { getClientConfig } from '@/lib/server-utils';

interface Client {
  id: string;
  companyName: string;
  googleAnalyticsPropertyId?: string;
  googleAdsCustomerId?: string;
  googleAdsMccId?: string;
}

interface MonthData {
  month: string;
  monthLabel: string;
  leads: number;
  adSpend: number;
  costPerLead: number;
  sessions: number;
  clicks: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const months = parseInt(searchParams.get('months') || '6');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Use database lookup via getClientConfig (supports both database and JSON fallback)
    const clientConfig = await getClientConfig(clientId);
    if (!clientConfig) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Map to expected Client interface format
    const client: Client = {
      id: clientConfig.id,
      companyName: clientConfig.companyName,
      googleAnalyticsPropertyId: clientConfig.googleAnalyticsPropertyId,
      googleAdsCustomerId: clientConfig.googleAdsCustomerId,
      googleAdsMccId: clientConfig.googleAdsMccId
    };

    const gaConnector = new GoogleAnalyticsConnector();
    const adsConnector = new GoogleAdsServiceAccountConnector();

    // Generate last 6 months dynamically based on current date
    const historicalData: MonthData[] = [];
    const today = new Date();

    console.log('[Historical Report] Fetching last', months, 'months of data for client:', client.companyName);
    console.log('[Historical Report] GA Property ID:', client.googleAnalyticsPropertyId);
    console.log('[Historical Report] Ads Customer ID:', client.googleAdsCustomerId);

    // Fetch data for each month
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;

      // For current month, only go up to today's date
      const isCurrentMonth = i === 0;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      console.log(`[Historical] Fetching ${monthLabel}: ${startDate} to ${endDate}`);

      const timeRange: TimeRange = {
        startDate,
        endDate,
        period: 'custom' as const
      };

      try {
        const [gaData, adsData] = await Promise.all([
          gaConnector.getBasicMetrics(timeRange, client.googleAnalyticsPropertyId).catch((err) => {
            console.error(`[Historical] GA Error for ${monthLabel}:`, err.message);
            console.error(`[Historical] GA Full Error:`, err);
            return { metrics: { sessions: 0, users: 0, conversions: 0, bounceRate: 0 } };
          }),
          adsConnector.getCampaignReport(
            timeRange,
            client.googleAdsCustomerId,
            client.googleAdsMccId
          ).catch((err) => {
            console.error(`[Historical] Ads Error for ${monthLabel}:`, err.message);
            console.error(`[Historical] Ads Full Error:`, err);
            console.error(`[Historical] Customer ID: ${client.googleAdsCustomerId}, MCC ID: ${client.googleAdsMccId}`);
            return { campaigns: [], totalMetrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } };
          })
        ]);

        // Use Google Ads conversions as leads (more accurate than GA conversions)
        const leads = adsData.totalMetrics?.conversions || 0;
        const adSpend = adsData.totalMetrics?.cost || 0;
        const costPerLead = leads > 0 ? adSpend / leads : 0;

        console.log(`[Historical] ${monthLabel} - Raw Ads Data:`, {
          conversions: adsData.totalMetrics?.conversions,
          cost: adsData.totalMetrics?.cost,
          clicks: adsData.totalMetrics?.clicks,
          impressions: adsData.totalMetrics?.impressions,
          campaignsCount: adsData.campaigns?.length
        });

        historicalData.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          monthLabel,
          leads: Math.round(leads),
          adSpend: Math.round(adSpend * 100) / 100,
          costPerLead: Math.round(costPerLead * 100) / 100,
          sessions: gaData.metrics?.sessions || 0,
          clicks: adsData.totalMetrics?.clicks || 0
        });

        console.log(`[Historical] ${monthLabel}: ${leads} leads, $${adSpend.toFixed(2)} spend, ${adsData.campaigns?.length || 0} campaigns`);
      } catch (error) {
        console.error(`[Historical] Error fetching ${monthLabel}:`, error);
        historicalData.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          monthLabel,
          leads: 0,
          adSpend: 0,
          costPerLead: 0,
          sessions: 0,
          clicks: 0
        });
      }
    }

    // Calculate insights
    const totalLeads = historicalData.reduce((sum, m) => sum + m.leads, 0);
    const totalSpend = historicalData.reduce((sum, m) => sum + m.adSpend, 0);
    const avgLeadsPerMonth = Math.round(totalLeads / historicalData.length);
    const bestMonth = historicalData.reduce((best, current) =>
      current.leads > best.leads ? current : best
    );
    const worstMonth = historicalData.reduce((worst, current) =>
      current.leads < worst.leads ? current : worst
    );

    // Calculate trend (comparing first 3 months vs last 3 months)
    const firstHalf = historicalData.slice(0, Math.floor(historicalData.length / 2));
    const secondHalf = historicalData.slice(Math.floor(historicalData.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.leads, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.leads, 0) / secondHalf.length;
    const trendPercentage = firstHalfAvg > 0
      ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
      : 0;

    // Log summary for debugging
    console.log('[Historical Report] ====== SUMMARY ======');
    console.log(`[Historical Report] Client: ${client.companyName}`);
    console.log(`[Historical Report] Total Leads: ${totalLeads}`);
    console.log(`[Historical Report] Total Spend: $${totalSpend.toFixed(2)}`);
    console.log(`[Historical Report] Avg Leads/Month: ${avgLeadsPerMonth}`);
    console.log(`[Historical Report] Best Month: ${bestMonth.monthLabel} (${bestMonth.leads} leads)`);
    console.log('[Historical Report] ========================\n');

    return NextResponse.json({
      success: true,
      data: {
        months: historicalData,
        insights: {
          totalLeads,
          totalSpend,
          avgLeadsPerMonth,
          bestMonth: {
            month: bestMonth.monthLabel,
            leads: bestMonth.leads
          },
          worstMonth: {
            month: worstMonth.monthLabel,
            leads: worstMonth.leads
          },
          trend: {
            direction: trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'flat',
            percentage: Math.abs(trendPercentage),
            description: trendPercentage > 0
              ? `Up ${trendPercentage}% from earlier months`
              : trendPercentage < 0
              ? `Down ${Math.abs(trendPercentage)}% from earlier months`
              : 'Flat compared to earlier months'
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Historical Report] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
