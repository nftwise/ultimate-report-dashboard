import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SearchConsolePerformanceData {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsolePage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleTotals {
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
}

export const getSearchConsoleClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials for Search Console');
  }

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  return google.searchconsole({ version: 'v1', auth: auth as any });
};

export const getSearchConsolePerformance = async (
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ performance: SearchConsolePerformanceData[]; totals: SearchConsoleTotals }> => {
  const searchconsole = getSearchConsoleClient();

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 1000
    }
  });

  const performance = response.data.rows?.map((row: any) => ({
    date: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  })) || [];

  const totals = {
    clicks: performance.reduce((sum, item) => sum + item.clicks, 0),
    impressions: performance.reduce((sum, item) => sum + item.impressions, 0),
    avgCtr: performance.length > 0 ?
      performance.reduce((sum, item) => sum + item.ctr, 0) / performance.length : 0,
    avgPosition: performance.length > 0 ?
      performance.reduce((sum, item) => sum + item.position, 0) / performance.length : 0
  };

  return { performance, totals };
};

export const getSearchConsoleQueries = async (
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<SearchConsoleQuery[]> => {
  const searchconsole = getSearchConsoleClient();

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: limit
    }
  });

  return response.data.rows?.map((row: any) => ({
    query: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  })) || [];
};

export const getSearchConsolePages = async (
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<SearchConsolePage[]> => {
  const searchconsole = getSearchConsoleClient();

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: limit
    }
  });

  return response.data.rows?.map((row: any) => ({
    page: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  })) || [];
};