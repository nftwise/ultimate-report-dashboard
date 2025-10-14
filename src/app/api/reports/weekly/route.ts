import { NextRequest, NextResponse } from 'next/server';
import { getTimeRangeDates } from '@/lib/utils';
import { GoogleAnalyticsConnector } from '@/lib/google-analytics';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

interface Client {
  id: string;
  companyName: string;
  searchConsoleSiteUrl: string;
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

    // Get current week and previous week data
    const currentWeekRange = getTimeRangeDates('7days');
    const previousWeekEnd = new Date(currentWeekRange.startDate);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    const previousWeekStart = new Date(previousWeekEnd);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousWeekRange = {
      startDate: previousWeekStart.toISOString().split('T')[0],
      endDate: previousWeekEnd.toISOString().split('T')[0],
      period: '7days' as const,
    };

    const gaConnector = new GoogleAnalyticsConnector();

    // Fetch current week data
    const [currentGA, currentTraffic] = await Promise.all([
      gaConnector.getBasicMetrics(currentWeekRange),
      gaConnector.getSessionsByDay(currentWeekRange),
    ]);

    // Fetch previous week data for comparison
    const [previousGA] = await Promise.all([
      gaConnector.getBasicMetrics(previousWeekRange),
    ]);

    // Calculate growth rates
    const trafficGrowth = previousGA.metrics.sessions > 0
      ? Math.round(((currentGA.metrics.sessions - previousGA.metrics.sessions) / previousGA.metrics.sessions) * 100)
      : 0;

    const leadsGrowth = previousGA.metrics.conversions > 0
      ? Math.round(((currentGA.metrics.conversions - previousGA.metrics.conversions) / previousGA.metrics.conversions) * 100)
      : 0;

    // Get Search Console ranking changes
    let rankingImprovements: any[] = [];
    let newTopKeywords = 0;

    try {
      if (client.searchConsoleSiteUrl) {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

        const auth = new JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
        });

        const searchconsole = google.searchconsole({ version: 'v1', auth: auth as any });

        const currentResponse = await searchconsole.searchanalytics.query({
          siteUrl: client.searchConsoleSiteUrl,
          requestBody: {
            startDate: currentWeekRange.startDate,
            endDate: currentWeekRange.endDate,
            dimensions: ['query'],
            rowLimit: 20
          }
        });

        const previousResponse = await searchconsole.searchanalytics.query({
          siteUrl: client.searchConsoleSiteUrl,
          requestBody: {
            startDate: previousWeekRange.startDate,
            endDate: previousWeekRange.endDate,
            dimensions: ['query'],
            rowLimit: 20
          }
        });

        const currentQueries = new Map(
          currentResponse.data.rows?.map((row: any) => [
            row.keys[0],
            { position: row.position }
          ]) || []
        );

        const previousQueries = new Map(
          previousResponse.data.rows?.map((row: any) => [
            row.keys[0],
            { position: row.position }
          ]) || []
        );

        // Find improvements (positive changes only)
        rankingImprovements = Array.from(currentQueries.entries())
          .map(([query, data]) => {
            const previousPosition = previousQueries.get(query)?.position || 999;
            const improvement = previousPosition - data.position;
            return {
              keyword: query,
              oldPosition: Math.round(previousPosition),
              newPosition: Math.round(data.position),
              improvement
            };
          })
          .filter(r => r.improvement > 1 && r.newPosition <= 20) // Only show significant improvements in top 20
          .sort((a, b) => b.improvement - a.improvement)
          .slice(0, 5); // Top 5 improvements

        // Count new top 3 keywords
        newTopKeywords = Array.from(currentQueries.entries()).filter(([query, data]) => {
          const previousPosition = previousQueries.get(query)?.position || 999;
          return data.position <= 3 && previousPosition > 3;
        }).length;
      }
    } catch (error) {
      console.error('Error fetching ranking data:', error);
    }

    // Determine this week's win
    let weekWin = {
      title: 'Steady Growth This Week',
      description: 'Your marketing efforts are maintaining consistent performance.',
      icon: '📊'
    };

    if (leadsGrowth > 30) {
      weekWin = {
        title: `Best Week Ever: ${currentGA.metrics.conversions} Leads!`,
        description: `You generated ${currentGA.metrics.conversions} leads this week - that's ${leadsGrowth}% more than last week!`,
        icon: '🚀'
      };
    } else if (rankingImprovements.length > 2) {
      weekWin = {
        title: 'Major SEO Breakthrough!',
        description: `${rankingImprovements.length} keywords jumped in rankings this week. Your visibility is skyrocketing!`,
        icon: '🏆'
      };
    } else if (trafficGrowth > 20) {
      weekWin = {
        title: 'Traffic Surge!',
        description: `${currentGA.metrics.sessions.toLocaleString()} visitors this week - up ${trafficGrowth}% from last week!`,
        icon: '📈'
      };
    }

    // Generate insight
    let insight = 'Your marketing momentum is building week over week.';
    if (trafficGrowth > 0 && leadsGrowth > 0) {
      insight = `Both traffic and leads are trending up! Your marketing is compounding - each week's work builds on the last.`;
    } else if (leadsGrowth > trafficGrowth) {
      insight = `Your lead quality is improving! You're converting a higher percentage of visitors into customers.`;
    } else if (rankingImprovements.length > 0) {
      insight = `Your SEO investments are paying off. Better rankings mean more free, high-intent traffic coming your way.`;
    }

    // Calculate money metrics (simplified - would need actual ad spend data)
    const estimatedRevenue = currentGA.metrics.conversions * 1200; // $1200 avg customer value
    const estimatedAdSpend = currentGA.metrics.conversions * 67; // Estimated $67 CPL
    const roas = estimatedAdSpend > 0 ? Math.round((estimatedRevenue / estimatedAdSpend) * 100) : 0;

    const reportData = {
      weekWin,
      moneyMetrics: {
        revenue: estimatedRevenue,
        roas,
        costPerLead: 67,
        costPerLeadImprovement: 15, // Example improvement
        adSpend: estimatedAdSpend,
      },
      competitiveEdge: {
        rankingImprovements,
        newTopKeywords,
      },
      growthTrend: {
        trafficGrowth,
        leadsGrowth,
        insight,
      },
      weekPeriod: {
        start: new Date(currentWeekRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        end: new Date(currentWeekRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      },
    };

    return NextResponse.json({
      success: true,
      data: reportData,
    });

  } catch (error) {
    console.error('Weekly report API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate weekly report',
    }, { status: 500 });
  }
}
