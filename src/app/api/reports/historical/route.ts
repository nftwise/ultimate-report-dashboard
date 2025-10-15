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

    const client = getClient(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const gaConnector = new GoogleAnalyticsConnector();
    const adsConnector = new GoogleAdsDirectConnector();

    // Generate last 6 months (May, June, July, Aug, Sept, Oct 2025)
    const historicalData: MonthData[] = [];
    const today = new Date('2025-10-15');

    console.log('[Historical Report] Fetching last', months, 'months of data');

    // Fetch data for each month
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;

      // For current month (October), only go up to today (Oct 15)
      const isCurrentMonth = i === 0;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = isCurrentMonth ? 15 : new Date(year, month, 0).getDate();
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
          gaConnector.getBasicMetrics(timeRange).catch(() => ({
            metrics: { sessions: 0, users: 0, conversions: 0, bounceRate: 0 }
          })),
          adsConnector.getCampaignReport(
            timeRange,
            client.googleAdsCustomerId,
            client.googleAdsMccId
          ).catch(() => ({
            campaigns: [],
            totalMetrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 }
          }))
        ]);

        const leads = gaData.metrics.conversions;
        const adSpend = adsData.totalMetrics?.cost || 0;
        const costPerLead = leads > 0 ? adSpend / leads : 0;

        historicalData.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          monthLabel,
          leads: Math.round(leads),
          adSpend: Math.round(adSpend * 100) / 100,
          costPerLead: Math.round(costPerLead * 100) / 100,
          sessions: gaData.metrics.sessions,
          clicks: adsData.totalMetrics?.clicks || 0
        });

        console.log(`[Historical] ${monthLabel}: ${leads} leads, $${adSpend.toFixed(2)} spend`);
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
