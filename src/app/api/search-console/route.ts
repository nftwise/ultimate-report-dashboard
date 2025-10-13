import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

interface Client {
  id: string;
  searchConsoleSiteUrl: string;
}

const getSearchConsoleClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials');
  }

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  return google.searchconsole({ version: 'v1', auth: auth as any });
};

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
    const period = searchParams.get('period') || '7d';
    const clientId = searchParams.get('clientId');
    const type = searchParams.get('type') || 'performance';

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = getClient(clientId);
    if (!client || !client.searchConsoleSiteUrl) {
      return NextResponse.json({ error: 'Client not found or Search Console URL not configured' }, { status: 404 });
    }

    const searchconsole = getSearchConsoleClient();
    const siteUrl = client.searchConsoleSiteUrl;

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
        await searchconsole.sites.list();
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
      // Get search performance data
      const response = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: ['date'],
          rowLimit: 1000
        }
      });

      const performanceData = response.data.rows?.map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      })) || [];

      return NextResponse.json({
        success: true,
        data: {
          performance: performanceData,
          totals: {
            clicks: performanceData.reduce((sum: number, item: any) => sum + item.clicks, 0),
            impressions: performanceData.reduce((sum: number, item: any) => sum + item.impressions, 0),
            avgCtr: performanceData.length > 0 ?
              performanceData.reduce((sum: number, item: any) => sum + item.ctr, 0) / performanceData.length : 0,
            avgPosition: performanceData.length > 0 ?
              performanceData.reduce((sum: number, item: any) => sum + item.position, 0) / performanceData.length : 0
          }
        }
      });
    }

    if (type === 'queries') {
      // Get top search queries
      const response = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: ['query'],
          rowLimit: 20
        }
      });

      const queries = response.data.rows?.map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      })) || [];

      return NextResponse.json({
        success: true,
        data: { queries }
      });
    }

    if (type === 'pages') {
      // Get top performing pages
      const response = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: ['page'],
          rowLimit: 20
        }
      });

      const pages = response.data.rows?.map((row: any) => ({
        page: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      })) || [];

      return NextResponse.json({
        success: true,
        data: { pages }
      });
    }

    if (type === 'competitive-analysis') {
      // Get ranking changes and competitive metrics
      // Current period data
      const currentResponse = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: ['query'],
          rowLimit: 50
        }
      });

      // Previous period data for comparison
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const previousResponse = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: previousStartDate.toISOString().split('T')[0],
          endDate: previousEndDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 50
        }
      });

      const currentQueries = new Map(
        currentResponse.data.rows?.map((row: any) => [
          row.keys[0],
          { position: row.position, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr }
        ]) || []
      );

      const previousQueries = new Map(
        previousResponse.data.rows?.map((row: any) => [
          row.keys[0],
          { position: row.position }
        ]) || []
      );

      // Calculate ranking changes
      const rankings = Array.from(currentQueries.entries())
        .map(([query, data]) => {
          const previousPosition = previousQueries.get(query)?.position || 0;
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

      return NextResponse.json({
        success: true,
        data: {
          rankings: rankings.slice(0, 15), // Top 15 ranking changes
          metrics: {
            averagePosition: Math.round(avgPosition * 10) / 10,
            previousAveragePosition: Math.round(previousAvgPosition * 10) / 10,
            topPositions,
            marketShare: Math.round(marketShare * 10) / 10,
            visibilityScore,
            beatCompetitors
          }
        }
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });

  } catch (error: any) {
    console.error('Search Console API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search Console API request failed',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}