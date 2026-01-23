import { google } from 'googleapis';
import { GBPReport, GBPMetrics, TimeRange } from '@/types';
import { GoogleOAuthManager } from './google-oauth';
import { supabaseAdmin } from './supabase';

export class GoogleBusinessProfileConnector {
  private auth: any;
  private useOAuth: boolean;
  private oauthRefreshToken?: string;

  constructor(useOAuth: boolean = false, oauthRefreshToken?: string) {
    this.useOAuth = useOAuth;
    this.oauthRefreshToken = oauthRefreshToken;

    if (!useOAuth) {
      // Fallback to service account (won't work for GBP, but kept for compatibility)
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        projectId: process.env.GOOGLE_PROJECT_ID,
        scopes: [
          'https://www.googleapis.com/auth/business.manage',
          'https://www.googleapis.com/auth/businessprofileperformance.readonly',
        ],
      });
    }
  }

  /**
   * Get OAuth2 access token from refresh token
   */
  private async getOAuthAccessToken(): Promise<string> {
    if (!this.oauthRefreshToken) {
      throw new Error('No OAuth refresh token available');
    }

    const oauthManager = new GoogleOAuthManager();
    return await oauthManager.getAccessToken(this.oauthRefreshToken);
  }


  /**
   * Get daily metrics time series for a location
   * @param locationId - The Google Business Profile location ID (format: accounts/{accountId}/locations/{locationId})
   * @param timeRange - The date range for the metrics
   */
  async getDailyMetrics(locationId: string, timeRange: TimeRange): Promise<GBPReport> {
    try {
      const client = await this.auth.getClient();
      const businessProfilePerformance = google.mybusinessbusinessinformation({
        version: 'v1',
        auth: client,
      });

      // Calculate date range
      const startDate = new Date(timeRange.startDate);
      const endDate = new Date(timeRange.endDate);

      // Fetch daily metrics time series
      const response = await this.makeRequest(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`,
        {
          dailyMetric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
          dailyRange: {
            startDate: {
              year: startDate.getFullYear(),
              month: startDate.getMonth() + 1,
              day: startDate.getDate(),
            },
            endDate: {
              year: endDate.getFullYear(),
              month: endDate.getMonth() + 1,
              day: endDate.getDate(),
            },
          },
        }
      );

      // Parse and aggregate metrics
      const metrics = this.parseMetrics(response);

      return {
        locationId,
        timeRange,
        metrics,
        raw: response,
      };
    } catch (error: any) {
      console.error('Error fetching GBP metrics:', error);
      throw new Error(`Failed to fetch Google Business Profile metrics: ${error.message}`);
    }
  }

  /**
   * Get all available metrics for a location
   */
  async getPerformanceMetrics(locationId: string, timeRange: TimeRange): Promise<GBPMetrics> {
    // Default empty metrics structure
    const emptyMetrics: GBPMetrics = {
      searchQueries: { direct: 0, indirect: 0, total: 0 },
      views: { search: 0, maps: 0, total: 0 },
      actions: { website: 0, phone: 0, directions: 0, total: 0 },
      photos: { merchantViews: 0, customerViews: 0, totalViews: 0 },
    };

    try {
      // Get access token (OAuth or service account)
      let accessToken: string;
      if (this.useOAuth) {
        accessToken = await this.getOAuthAccessToken();
        console.log('[GBP] Using OAuth2 access token');
      } else {
        const client = await this.auth.getClient();
        const token = await client.getAccessToken();
        accessToken = token.token!;
        console.log('[GBP] Using service account token');
      }

      const startDate = new Date(timeRange.startDate);
      const endDate = new Date(timeRange.endDate);

      const dateRange = {
        startDate: {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        },
        endDate: {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
        },
      };

      // Fetch multiple metrics in parallel
      const metricTypes = [
        'QUERIES_DIRECT',
        'QUERIES_INDIRECT',
        'VIEWS_MAPS',
        'VIEWS_SEARCH',
        'ACTIONS_WEBSITE',
        'ACTIONS_PHONE',
        'ACTIONS_DRIVING_DIRECTIONS',
        'PHOTOS_VIEWS_MERCHANT',
        'PHOTOS_VIEWS_CUSTOMERS',
      ];

      const metricsPromises = metricTypes.map(async (metricType) => {
        try {
          const data = await this.makeAuthenticatedRequest(
            `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`,
            accessToken,
            {
              dailyMetric: metricType,
              dailyRange: dateRange,
            }
          );
          return { metricType, data };
        } catch (error) {
          console.error(`Error fetching ${metricType}:`, error);
          return { metricType, data: null };
        }
      });

      const results = await Promise.all(metricsPromises);

      // Aggregate all metrics
      const aggregatedMetrics: GBPMetrics = {
        searchQueries: {
          direct: 0,
          indirect: 0,
          total: 0,
        },
        views: {
          search: 0,
          maps: 0,
          total: 0,
        },
        actions: {
          website: 0,
          phone: 0,
          directions: 0,
          total: 0,
        },
        photos: {
          merchantViews: 0,
          customerViews: 0,
          totalViews: 0,
        },
      };

      results.forEach(({ metricType, data }) => {
        if (data && data.timeSeries) {
          const total = this.sumTimeSeries(data.timeSeries);

          switch (metricType) {
            case 'QUERIES_DIRECT':
              aggregatedMetrics.searchQueries.direct = total;
              break;
            case 'QUERIES_INDIRECT':
              aggregatedMetrics.searchQueries.indirect = total;
              break;
            case 'VIEWS_MAPS':
              aggregatedMetrics.views.maps = total;
              break;
            case 'VIEWS_SEARCH':
              aggregatedMetrics.views.search = total;
              break;
            case 'ACTIONS_WEBSITE':
              aggregatedMetrics.actions.website = total;
              break;
            case 'ACTIONS_PHONE':
              aggregatedMetrics.actions.phone = total;
              break;
            case 'ACTIONS_DRIVING_DIRECTIONS':
              aggregatedMetrics.actions.directions = total;
              break;
            case 'PHOTOS_VIEWS_MERCHANT':
              aggregatedMetrics.photos.merchantViews = total;
              break;
            case 'PHOTOS_VIEWS_CUSTOMERS':
              aggregatedMetrics.photos.customerViews = total;
              break;
          }
        }
      });

      // Calculate totals
      aggregatedMetrics.searchQueries.total =
        aggregatedMetrics.searchQueries.direct + aggregatedMetrics.searchQueries.indirect;
      aggregatedMetrics.views.total =
        aggregatedMetrics.views.search + aggregatedMetrics.views.maps;
      aggregatedMetrics.actions.total =
        aggregatedMetrics.actions.website +
        aggregatedMetrics.actions.phone +
        aggregatedMetrics.actions.directions;
      aggregatedMetrics.photos.totalViews =
        aggregatedMetrics.photos.merchantViews + aggregatedMetrics.photos.customerViews;

      return aggregatedMetrics;
    } catch (error: any) {
      console.warn('[GBP] Unable to fetch metrics (permissions/access issue), returning empty data:', error.message);
      return emptyMetrics;
    }
  }

  /**
   * Helper function to make authenticated requests
   */
  private async makeAuthenticatedRequest(url: string, accessToken: string, body: any): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Helper function to make requests (for backward compatibility)
   */
  private async makeRequest(url: string, body: any): Promise<any> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return this.makeAuthenticatedRequest(url, accessToken.token!, body);
  }

  /**
   * Sum values from time series data
   */
  private sumTimeSeries(timeSeries: any): number {
    if (!timeSeries || !timeSeries.datedValues) {
      return 0;
    }

    return timeSeries.datedValues.reduce((sum: number, item: any) => {
      return sum + (item.value || 0);
    }, 0);
  }

  /**
   * Parse metrics from API response
   */
  private parseMetrics(response: any): GBPMetrics {
    // Default metrics structure
    const metrics: GBPMetrics = {
      searchQueries: {
        direct: 0,
        indirect: 0,
        total: 0,
      },
      views: {
        search: 0,
        maps: 0,
        total: 0,
      },
      actions: {
        website: 0,
        phone: 0,
        directions: 0,
        total: 0,
      },
      photos: {
        merchantViews: 0,
        customerViews: 0,
        totalViews: 0,
      },
    };

    // Parse response and populate metrics
    if (response && response.timeSeries) {
      const total = this.sumTimeSeries(response.timeSeries);
      // This is just for the initial metric, we'll get all metrics separately
      metrics.views.maps = total;
      metrics.views.total = total;
    }

    return metrics;
  }

  /**
   * Get reviews for a location
   * @param locationId - The location ID (format: locations/{locationId})
   * @param accessToken - OAuth2 access token
   */
  static async getReviews(locationId: string, accessToken: string): Promise<{
    totalReviews: number;
    averageRating: number;
    newReviews: number;
    daysSinceLastReview: number;
  }> {
    try {
      const response = await fetch(
        `https://mybusiness.googleapis.com/v4/${locationId}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[GBP Reviews] API returned ${response.status} for ${locationId}`);
        return { totalReviews: 0, averageRating: 0, newReviews: 0, daysSinceLastReview: 0 };
      }

      const data = await response.json();
      const reviews = data.reviews || [];

      // Calculate metrics
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? reviews.reduce((sum: number, r: any) => sum + (r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4 : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1), 0) / totalReviews
        : 0;

      // New reviews in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newReviews = reviews.filter((r: any) => {
        const reviewDate = new Date(r.createTime);
        return reviewDate >= thirtyDaysAgo;
      }).length;

      // Days since last review
      let daysSinceLastReview = 0;
      if (reviews.length > 0) {
        const sortedReviews = reviews.sort((a: any, b: any) =>
          new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
        );
        const lastReviewDate = new Date(sortedReviews[0].createTime);
        const today = new Date();
        daysSinceLastReview = Math.floor((today.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return { totalReviews, averageRating, newReviews, daysSinceLastReview };
    } catch (error: any) {
      console.error('[GBP Reviews] Error:', error.message);
      return { totalReviews: 0, averageRating: 0, newReviews: 0, daysSinceLastReview: 0 };
    }
  }

  /**
   * Get posts for a location
   * @param locationId - The location ID (format: locations/{locationId})
   * @param accessToken - OAuth2 access token
   */
  static async getPosts(locationId: string, accessToken: string): Promise<{
    postsCount: number;
    postsViews: number;
    postsClicks: number;
    daysSinceLastPost: number;
  }> {
    try {
      const response = await fetch(
        `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[GBP Posts] API returned ${response.status} for ${locationId}`);
        return { postsCount: 0, postsViews: 0, postsClicks: 0, daysSinceLastPost: 0 };
      }

      const data = await response.json();
      const posts = data.localPosts || [];

      const postsCount = posts.length;
      const postsViews = posts.reduce((sum: number, p: any) => sum + (p.searchUrl?.impressions || 0), 0);
      const postsClicks = posts.reduce((sum: number, p: any) => sum + (p.searchUrl?.clicks || 0), 0);

      // Days since last post
      let daysSinceLastPost = 0;
      if (posts.length > 0) {
        const sortedPosts = posts.sort((a: any, b: any) =>
          new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
        );
        const lastPostDate = new Date(sortedPosts[0].createTime);
        const today = new Date();
        daysSinceLastPost = Math.floor((today.getTime() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return { postsCount, postsViews, postsClicks, daysSinceLastPost };
    } catch (error: any) {
      console.error('[GBP Posts] Error:', error.message);
      return { postsCount: 0, postsViews: 0, postsClicks: 0, daysSinceLastPost: 0 };
    }
  }

  /**
   * Fetch all GBP accounts and locations for the authenticated user
   * @param accessToken - The OAuth2 access token
   * @returns Array of locations with account and location IDs
   */
  static async fetchAccountsAndLocations(accessToken: string): Promise<{
    accounts: Array<{ name: string; accountName: string }>;
    locations: Array<{ name: string; locationName: string; title: string; address?: string }>;
  }> {
    const accounts: Array<{ name: string; accountName: string }> = [];
    const locations: Array<{ name: string; locationName: string; title: string; address?: string }> = [];

    try {
      // Step 1: List all accounts
      console.log('[GBP Discovery] Fetching accounts...');
      const accountsResponse = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('[GBP Discovery] Accounts API error:', accountsResponse.status, errorText);
        throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
      }

      const accountsData = await accountsResponse.json();
      console.log('[GBP Discovery] Accounts response:', JSON.stringify(accountsData, null, 2));

      if (accountsData.accounts) {
        for (const account of accountsData.accounts) {
          accounts.push({
            name: account.name,
            accountName: account.accountName || account.name,
          });

          // Step 2: List locations for each account
          console.log(`[GBP Discovery] Fetching locations for account: ${account.name}`);
          try {
            const locationsResponse = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json();
              console.log('[GBP Discovery] Locations response:', JSON.stringify(locationsData, null, 2));

              if (locationsData.locations) {
                for (const location of locationsData.locations) {
                  locations.push({
                    name: location.name, // format: locations/{locationId}
                    locationName: location.name,
                    title: location.title || 'Unknown Business',
                    address: location.storefrontAddress?.formattedAddress,
                  });
                }
              }
            } else {
              console.error(`[GBP Discovery] Could not fetch locations for ${account.name}:`, locationsResponse.status);
            }
          } catch (locError) {
            console.error(`[GBP Discovery] Error fetching locations for ${account.name}:`, locError);
          }
        }
      }

      return { accounts, locations };
    } catch (error) {
      console.error('[GBP Discovery] Error:', error);
      throw error;
    }
  }
}
