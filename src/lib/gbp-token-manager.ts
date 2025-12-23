import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GBP Token Manager
 * Stores OAuth tokens in Supabase (works on Vercel serverless)
 * Falls back to local files for development
 * Auto-refreshes tokens when needed
 */

const TOKEN_KEY = 'gbp_agency_master';
const LOCAL_TOKEN_DIR = '.oauth-tokens';
const MASTER_TOKEN_FILE = 'gbp-master.json';

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email?: string;
}

export class GBPTokenManager {
  private static oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  /**
   * Get valid access token (auto-refreshes if expired)
   */
  static async getAccessToken(): Promise<string | null> {
    const stored = await this.getStoredToken();
    if (!stored) return null;

    // Check if token is expired (with 5 min buffer)
    const isExpired = stored.expiry_date < Date.now() + 5 * 60 * 1000;

    if (isExpired && stored.refresh_token) {
      // Refresh the token
      this.oauth2Client.setCredentials({ refresh_token: stored.refresh_token });
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        await this.saveToken({
          access_token: credentials.access_token!,
          refresh_token: stored.refresh_token, // Keep original refresh token
          expiry_date: credentials.expiry_date!,
          email: stored.email,
        });
        return credentials.access_token!;
      } catch (error) {
        console.error('[GBP] Token refresh failed:', error);
        return null;
      }
    }

    return stored.access_token;
  }

  /**
   * Save token to Supabase
   */
  static async saveToken(token: StoredToken): Promise<void> {
    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: TOKEN_KEY,
        value: JSON.stringify(token),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('[GBP] Failed to save token:', error);
      throw error;
    }
  }

  /**
   * Get stored token from Supabase (falls back to local files)
   */
  static async getStoredToken(): Promise<StoredToken | null> {
    // Try Supabase first
    try {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', TOKEN_KEY)
        .single();

      if (!error && data) {
        return JSON.parse(data.value);
      }
    } catch (e) {
      // Table might not exist, fall through to local files
    }

    // Fallback: Read from local files (for development)
    try {
      // Try master token file first
      const masterPath = path.join(process.cwd(), LOCAL_TOKEN_DIR, MASTER_TOKEN_FILE);
      if (fs.existsSync(masterPath)) {
        const tokenData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
        return {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expiry_date: tokenData.expiry_date,
          email: tokenData.email,
        };
      }

      // Fallback: Find any valid GBP token file
      const tokenDir = path.join(process.cwd(), LOCAL_TOKEN_DIR);
      if (fs.existsSync(tokenDir)) {
        const files = fs.readdirSync(tokenDir).filter(f => f.endsWith('-gbp.json'));
        for (const file of files) {
          const tokenPath = path.join(tokenDir, file);
          const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
          // Check if token is not expired
          if (tokenData.expiry_date > Date.now()) {
            return {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expiry_date: tokenData.expiry_date,
              email: tokenData.email,
            };
          }
        }
      }
    } catch (e) {
      console.error('[GBP] Failed to read local token files:', e);
    }

    return null;
  }

  /**
   * Check token status
   */
  static async getStatus(): Promise<{
    exists: boolean;
    valid: boolean;
    email?: string;
    expiresAt?: string;
  }> {
    const stored = await this.getStoredToken();
    if (!stored) return { exists: false, valid: false };

    const isValid = stored.expiry_date > Date.now();
    return {
      exists: true,
      valid: isValid,
      email: stored.email,
      expiresAt: new Date(stored.expiry_date).toISOString(),
    };
  }

  /**
   * Generate OAuth URL for authentication
   */
  static getAuthUrl(redirectUri: string): string {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
  }

  /**
   * Exchange auth code for tokens
   */
  static async exchangeCode(code: string, redirectUri: string): Promise<StoredToken> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const storedToken: StoredToken = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      email: data.email || undefined,
    };

    await this.saveToken(storedToken);
    return storedToken;
  }
}

/**
 * Fetch GBP phone calls for a location
 */
export async function fetchGBPCalls(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const token = await GBPTokenManager.getAccessToken();
  if (!token) {
    console.log('[GBP] No valid token available');
    return 0;
  }

  // Normalize location ID to "locations/XXX" format
  let normalizedId = locationId;
  if (locationId.includes('/locations/')) {
    normalizedId = `locations/${locationId.split('/locations/')[1]}`;
  } else if (!locationId.startsWith('locations/')) {
    normalizedId = `locations/${locationId}`;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    // Build URL with query params (GET method required)
    const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`);
    url.searchParams.set('dailyMetric', 'CALL_CLICKS');
    url.searchParams.set('dailyRange.start_date.year', start.getFullYear().toString());
    url.searchParams.set('dailyRange.start_date.month', (start.getMonth() + 1).toString());
    url.searchParams.set('dailyRange.start_date.day', start.getDate().toString());
    url.searchParams.set('dailyRange.end_date.year', end.getFullYear().toString());
    url.searchParams.set('dailyRange.end_date.month', (end.getMonth() + 1).toString());
    url.searchParams.set('dailyRange.end_date.day', end.getDate().toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.log(`[GBP] API error for ${normalizedId}:`, response.status);
      return 0;
    }

    const data = await response.json();
    const calls = (data.timeSeries?.datedValues || [])
      .reduce((sum: number, d: any) => sum + (parseInt(d.value) || 0), 0);

    return calls;
  } catch (error) {
    console.error('[GBP] Fetch error:', error);
    return 0;
  }
}

/**
 * Fetch comprehensive GBP performance metrics for a location
 * Returns: website clicks, directions, profile views, searches, reviews, posts
 */
export async function fetchGBPPerformanceMetrics(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<{
  websiteClicks: number;
  directionRequests: number;
  businessProfileViews: number;
  searchesDirect: number;
  searchesDiscovery: number;
  totalReviews: number;
  newReviews: number;
  averageRating: number;
  questionsAnswers: number;
  daysSinceLastReview: number;
  photosCount: number;
  postsCount: number;
  postsViews: number;
  postsClicks: number;
  daysSinceLastPost: number;
} | null> {
  const token = await GBPTokenManager.getAccessToken();
  if (!token) {
    console.log('[GBP] No valid token available');
    return null;
  }

  // Normalize location ID
  let normalizedId = locationId;
  if (locationId.includes('/locations/')) {
    normalizedId = `locations/${locationId.split('/locations/')[1]}`;
  } else if (!locationId.startsWith('locations/')) {
    normalizedId = `locations/${locationId}`;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const result = {
    websiteClicks: 0,
    directionRequests: 0,
    businessProfileViews: 0,
    searchesDirect: 0,
    searchesDiscovery: 0,
    totalReviews: 0,
    newReviews: 0,
    averageRating: 0,
    questionsAnswers: 0,
    daysSinceLastReview: 0,
    photosCount: 0,
    postsCount: 0,
    postsViews: 0,
    postsClicks: 0,
    daysSinceLastPost: 0,
  };

  try {
    // Fetch multiple metrics in parallel (using valid v1 API metric names)
    // See: https://developers.google.com/my-business/reference/performance/rest/v1/locations/getDailyMetricsTimeSeries
    const metrics = [
      'WEBSITE_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_BOOKINGS',
      'BUSINESS_FOOD_ORDERS',
    ];

    const metricPromises = metrics.map(async (metric) => {
      try {
        // Build URL with query params (GET method required)
        const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`);
        url.searchParams.set('dailyMetric', metric);
        url.searchParams.set('dailyRange.start_date.year', start.getFullYear().toString());
        url.searchParams.set('dailyRange.start_date.month', (start.getMonth() + 1).toString());
        url.searchParams.set('dailyRange.start_date.day', start.getDate().toString());
        url.searchParams.set('dailyRange.end_date.year', end.getFullYear().toString());
        url.searchParams.set('dailyRange.end_date.month', (end.getMonth() + 1).toString());
        url.searchParams.set('dailyRange.end_date.day', end.getDate().toString());

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) return { metric, value: 0 };

        const data = await response.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum: number, d: any) => sum + (parseInt(d.value) || 0), 0);
        return { metric, value };
      } catch {
        return { metric, value: 0 };
      }
    });

    const metricResults = await Promise.all(metricPromises);

    // Track impressions to sum for profile views
    let totalImpressions = 0;

    metricResults.forEach(({ metric, value }) => {
      switch (metric) {
        case 'WEBSITE_CLICKS':
          result.websiteClicks = value;
          break;
        case 'BUSINESS_DIRECTION_REQUESTS':
          result.directionRequests = value;
          break;
        case 'CALL_CLICKS':
          // Note: This is captured separately by fetchGBPCalls, but we can also use it here
          break;
        case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
        case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
        case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
        case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
          totalImpressions += value;
          break;
      }
    });

    result.businessProfileViews = totalImpressions;

    // Fetch reviews from My Business API v4
    // Need account ID to fetch reviews - extract from locationId if present
    try {
      console.log('[GBP] Fetching reviews for:', locationId);
      const reviewsData = await fetchGBPReviews(locationId, token);
      if (reviewsData) {
        console.log('[GBP] Reviews data:', JSON.stringify(reviewsData));
        result.totalReviews = reviewsData.totalReviews;
        result.averageRating = reviewsData.averageRating;
        result.newReviews = reviewsData.newReviews;
        result.daysSinceLastReview = reviewsData.daysSinceLastReview;
      } else {
        console.log('[GBP] Reviews returned null');
      }
    } catch (e) {
      console.log('[GBP] Reviews fetch error:', (e as Error).message);
    }

    // Fetch posts from My Business API
    try {
      const postsData = await fetchGBPPosts(locationId, token);
      if (postsData) {
        result.postsCount = postsData.postsCount;
        result.postsViews = postsData.postsViews;
        result.postsClicks = postsData.postsClicks;
        result.daysSinceLastPost = postsData.daysSinceLastPost;
      }
    } catch (e) {
      console.log('[GBP] Posts fetch skipped:', (e as Error).message);
    }

    // Fetch photos count
    try {
      const photosData = await fetchGBPPhotos(locationId, token);
      if (photosData) {
        result.photosCount = photosData.photosCount;
      }
    } catch (e) {
      console.log('[GBP] Photos fetch skipped:', (e as Error).message);
    }

    return result;
  } catch (error) {
    console.error('[GBP] Performance metrics fetch error:', error);
    return null;
  }
}

/**
 * Fetch GBP reviews using My Business API
 */
async function fetchGBPReviews(
  locationId: string,
  token: string
): Promise<{
  totalReviews: number;
  averageRating: number;
  newReviews: number;
  daysSinceLastReview: number;
} | null> {
  // Extract account and location from full path if present
  // Format could be: accounts/XXX/locations/YYY or just YYY
  let accountId = '';
  let locId = locationId;

  if (locationId.includes('/')) {
    const parts = locationId.split('/');
    if (parts.length >= 4 && parts[0] === 'accounts') {
      accountId = parts[1];
      locId = parts[3];
    } else if (parts[0] === 'locations') {
      locId = parts[1];
    }
  }

  // If no account ID, we need to find it from the location
  if (!accountId) {
    // Try to get account from location using Account Management API
    try {
      const accountsResp = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (accountsResp.ok) {
        const accountsData = await accountsResp.json();
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          accountId = accountsData.accounts[0].name?.replace('accounts/', '') || '';
        }
      }
    } catch (e) {
      return null;
    }
  }

  if (!accountId) {
    console.log('[GBP Reviews] No account ID found');
    return null;
  }

  console.log('[GBP Reviews] Using accountId:', accountId, 'locId:', locId);

  try {
    // Fetch reviews using My Business API v4
    const reviewsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locId}/reviews`;
    console.log('[GBP Reviews] Fetching from:', reviewsUrl);

    const response = await fetch(reviewsUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('[GBP Reviews] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[GBP Reviews] Error response:', errorText);

      // Try Business Profile API v1 endpoint for basic metadata
      const altUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locId}?readMask=metadata`;
      console.log('[GBP Reviews] Trying alt URL:', altUrl);

      const altResponse = await fetch(altUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('[GBP Reviews] Alt response status:', altResponse.status);

      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.log('[GBP Reviews] Alt error:', altErrorText);
        return null;
      }

      const locationData = await altResponse.json();
      console.log('[GBP Reviews] Alt data:', JSON.stringify(locationData));
      return {
        totalReviews: locationData.metadata?.totalReviewCount || 0,
        averageRating: locationData.metadata?.averageRating || 0,
        newReviews: 0,
        daysSinceLastReview: 0,
      };
    }

    const data = await response.json();
    const reviews = data.reviews || [];
    const totalReviews = data.totalReviewCount || reviews.length;
    const avgRating = data.averageRating || 0;

    // Calculate new reviews (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newReviews = reviews.filter((r: any) => {
      const reviewDate = new Date(r.createTime).getTime();
      return reviewDate >= sevenDaysAgo;
    }).length;

    // Days since last review
    let daysSinceLastReview = 0;
    if (reviews.length > 0) {
      const lastReviewDate = new Date(reviews[0].createTime);
      daysSinceLastReview = Math.floor((Date.now() - lastReviewDate.getTime()) / (24 * 60 * 60 * 1000));
    }

    return {
      totalReviews,
      averageRating: avgRating,
      newReviews,
      daysSinceLastReview,
    };
  } catch (error) {
    console.error('[GBP] Reviews API error:', error);
    return null;
  }
}

/**
 * Fetch GBP posts using My Business API
 */
async function fetchGBPPosts(
  locationId: string,
  token: string
): Promise<{
  postsCount: number;
  postsViews: number;
  postsClicks: number;
  daysSinceLastPost: number;
} | null> {
  // Extract account and location IDs
  let accountId = '';
  let locId = locationId;

  if (locationId.includes('/')) {
    const parts = locationId.split('/');
    if (parts.length >= 4 && parts[0] === 'accounts') {
      accountId = parts[1];
      locId = parts[3];
    } else if (parts[0] === 'locations') {
      locId = parts[1];
    }
  }

  if (!accountId) {
    // Get account ID
    try {
      const accountsResp = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (accountsResp.ok) {
        const accountsData = await accountsResp.json();
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          accountId = accountsData.accounts[0].name?.replace('accounts/', '') || '';
        }
      }
    } catch (e) {
      return null;
    }
  }

  if (!accountId) return null;

  try {
    // Fetch posts using My Business API v4
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locId}/localPosts`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const posts = data.localPosts || [];

    let totalViews = 0;
    let totalClicks = 0;

    posts.forEach((post: any) => {
      if (post.searchInsights) {
        totalViews += post.searchInsights.queries?.length || 0;
      }
      if (post.callToAction?.url) {
        totalClicks += post.topicType === 'OFFER' ? 1 : 0; // Simplified
      }
    });

    // Days since last post
    let daysSinceLastPost = 0;
    if (posts.length > 0) {
      const lastPostDate = new Date(posts[0].createTime);
      daysSinceLastPost = Math.floor((Date.now() - lastPostDate.getTime()) / (24 * 60 * 60 * 1000));
    }

    return {
      postsCount: posts.length,
      postsViews: totalViews,
      postsClicks: totalClicks,
      daysSinceLastPost,
    };
  } catch (error) {
    console.error('[GBP] Posts API error:', error);
    return null;
  }
}

/**
 * Fetch GBP photos count
 */
async function fetchGBPPhotos(
  locationId: string,
  token: string
): Promise<{ photosCount: number } | null> {
  let accountId = '';
  let locId = locationId;

  if (locationId.includes('/')) {
    const parts = locationId.split('/');
    if (parts.length >= 4 && parts[0] === 'accounts') {
      accountId = parts[1];
      locId = parts[3];
    } else if (parts[0] === 'locations') {
      locId = parts[1];
    }
  }

  if (!accountId) {
    try {
      const accountsResp = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (accountsResp.ok) {
        const accountsData = await accountsResp.json();
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          accountId = accountsData.accounts[0].name?.replace('accounts/', '') || '';
        }
      }
    } catch (e) {
      return null;
    }
  }

  if (!accountId) return null;

  try {
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locId}/media`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const photos = data.mediaItems || [];

    return { photosCount: photos.length };
  } catch (error) {
    return null;
  }
}
