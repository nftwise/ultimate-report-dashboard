import { JWT, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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

// Create JWT client for service account authentication (fallback)
const getServiceAccountClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials for Search Console');
  }

  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
};

// Get OAuth client from stored tokens
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getOAuthClient = async (clientId: string): Promise<any | null> => {
  try {
    const tokenFile = path.join(process.cwd(), '.oauth-tokens', `${clientId}-gsc.json`);

    if (!fs.existsSync(tokenFile)) {
      return null;
    }

    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials(tokens);

    // Check if token needs refresh
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Save refreshed tokens
      fs.writeFileSync(tokenFile, JSON.stringify(credentials, null, 2));
    }

    return oauth2Client;
  } catch (error) {
    console.error('[GSC] Error getting OAuth client:', error);
    return null;
  }
};

// Get the appropriate auth client (OAuth first, then service account fallback)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAuthClient = async (clientId?: string): Promise<JWT | any | null> => {
  // Try OAuth first if clientId is provided
  if (clientId) {
    const oauthClient = await getOAuthClient(clientId);
    if (oauthClient) {
      console.log('[GSC] Using OAuth client for:', clientId);
      return oauthClient;
    }
  }

  // Fall back to service account
  console.log('[GSC] Using service account client');
  return getServiceAccountClient();
};

// Make direct API request to Search Console API
async function makeSearchConsoleRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
  clientId?: string
): Promise<any> {
  const auth = await getAuthClient(clientId);
  if (!auth) throw new Error('Failed to get auth client');
  const tokenResponse = await auth.getAccessToken();

  const url = `https://www.googleapis.com/webmasters/v3${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${tokenResponse.token}`,
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

export const getSearchConsoleClient = getAuthClient;

export const getSearchConsolePerformance = async (
  siteUrl: string,
  startDate: string,
  endDate: string,
  clientId?: string
): Promise<{ performance: SearchConsolePerformanceData[]; totals: SearchConsoleTotals }> => {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await makeSearchConsoleRequest(
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 1000
    },
    clientId
  );

  const performance = response.rows?.map((row: any) => ({
    date: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  })) || [];

  const totals = {
    clicks: performance.reduce((sum: number, item: SearchConsolePerformanceData) => sum + item.clicks, 0),
    impressions: performance.reduce((sum: number, item: SearchConsolePerformanceData) => sum + item.impressions, 0),
    avgCtr: performance.length > 0 ?
      performance.reduce((sum: number, item: SearchConsolePerformanceData) => sum + item.ctr, 0) / performance.length : 0,
    avgPosition: performance.length > 0 ?
      performance.reduce((sum: number, item: SearchConsolePerformanceData) => sum + item.position, 0) / performance.length : 0
  };

  return { performance, totals };
};

export const getSearchConsoleQueries = async (
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 20,
  clientId?: string
): Promise<SearchConsoleQuery[]> => {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await makeSearchConsoleRequest(
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: limit
    },
    clientId
  );

  return response.rows?.map((row: any) => ({
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
  limit: number = 20,
  clientId?: string
): Promise<SearchConsolePage[]> => {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await makeSearchConsoleRequest(
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: limit
    },
    clientId
  );

  return response.rows?.map((row: any) => ({
    page: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  })) || [];
};
