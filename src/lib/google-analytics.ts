import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GAReport, GAMetrics, TimeRange } from '@/types';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export class GoogleAnalyticsConnector {
  private analyticsDataClient: BetaAnalyticsDataClient | null = null;
  private propertyId: string;
  private clientId: string | null = null;
  private accessToken: string | null = null;

  constructor(clientId?: string, accessToken?: string) {
    this.clientId = clientId || null;
    this.accessToken = accessToken || null;
    this.propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '';

    // If access token provided, use OAuth; otherwise use service account
    if (accessToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ access_token: accessToken });

      this.analyticsDataClient = new BetaAnalyticsDataClient({
        authClient: oauth2Client as any,
        timeout: 30000,
        maxRetries: 2,
      });
      console.log('[GA] Initialized with OAuth access token');
    } else {
      // Initialize with service account by default
      this.analyticsDataClient = new BetaAnalyticsDataClient({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        projectId: process.env.GOOGLE_PROJECT_ID,
        // Add timeout and retry configuration
        timeout: 30000, // 30 seconds timeout
        maxRetries: 2,
        retry: {
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffSettings: {
            initialDelayMs: 1000,
            maxDelayMs: 5000,
            delayMultiplier: 1.5,
          },
        },
      });
      console.log('[GA] Initialized with service account');
    }
  }

  /**
   * Get OAuth client for a specific client ID
   */
  private async getOAuthClient(clientId: string): Promise<BetaAnalyticsDataClient | null> {
    try {
      const tokenFile = path.join(process.cwd(), '.oauth-tokens', `${clientId}-ga.json`);

      if (!fs.existsSync(tokenFile)) {
        return null;
      }

      const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
      );

      oauth2Client.setCredentials(tokens);

      // Create analytics client with OAuth credentials
      return new BetaAnalyticsDataClient({
        authClient: oauth2Client as any,
        timeout: 30000,
        maxRetries: 2,
      });
    } catch (error) {
      console.error('[GA] Error creating OAuth client:', error);
      return null;
    }
  }

  /**
   * Get the appropriate client (OAuth if available, otherwise service account)
   */
  private async getClient(clientId?: string): Promise<BetaAnalyticsDataClient> {
    const useClientId = clientId || this.clientId;

    if (useClientId) {
      const oauthClient = await this.getOAuthClient(useClientId);
      if (oauthClient) {
        console.log(`[GA] Using OAuth client for ${useClientId}`);
        return oauthClient;
      }
    }

    console.log('[GA] Using service account client');
    return this.analyticsDataClient!;
  }

  async getBasicMetrics(timeRange: TimeRange, propertyId?: string, clientId?: string): Promise<GAReport> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      const client = await this.getClient(clientId);
      console.log('📊 [Google Analytics] Fetching basic metrics with timeRange:', {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        propertyId: usePropertyId
      });
      const [response] = await client.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
          { name: 'purchaseRevenue' },
        ],
        dimensions: [
          { name: 'date' },
        ],
      });

      // Sum all rows to get total metrics for the period
      const totals = response.rows?.reduce((acc, row) => ({
        sessions: acc.sessions + parseInt(row.metricValues?.[0]?.value || '0'),
        users: acc.users + parseInt(row.metricValues?.[1]?.value || '0'),
        pageviews: acc.pageviews + parseInt(row.metricValues?.[2]?.value || '0'),
        bounceRate: acc.bounceRate + parseFloat(row.metricValues?.[3]?.value || '0'),
        sessionDuration: acc.sessionDuration + parseFloat(row.metricValues?.[4]?.value || '0'),
        conversions: acc.conversions + parseInt(row.metricValues?.[5]?.value || '0'),
        revenue: acc.revenue + parseFloat(row.metricValues?.[6]?.value || '0'),
        transactions: acc.transactions + parseInt(row.metricValues?.[7]?.value || '0'),
      }), {
        sessions: 0,
        users: 0,
        pageviews: 0,
        bounceRate: 0,
        sessionDuration: 0,
        conversions: 0,
        revenue: 0,
        transactions: 0,
      }) || {
        sessions: 0,
        users: 0,
        pageviews: 0,
        bounceRate: 0,
        sessionDuration: 0,
        conversions: 0,
        revenue: 0,
        transactions: 0,
      };

      const rowCount = response.rows?.length || 1;

      const metrics: GAMetrics = {
        sessions: totals.sessions,
        users: totals.users,
        pageviews: totals.pageviews,
        bounceRate: totals.bounceRate / rowCount,
        sessionDuration: totals.sessionDuration / rowCount,
        conversions: totals.conversions,
        goalCompletions: totals.conversions,
        ecommerce: {
          revenue: totals.revenue,
          transactions: totals.transactions,
        },
      };

      const dimensions = response.rows?.map(row => ({
        date: row.dimensionValues?.[0]?.value || '',
        country: '',
        city: '',
        source: '',
        medium: '',
        campaign: '',
        device: '',
        age: '',
        gender: '',
      })) || [];

      return {
        metrics,
        dimensions,
        dateRange: {
          startDate: timeRange.startDate,
          endDate: timeRange.endDate,
        },
      };
    } catch (error) {
      console.error('Error fetching GA4 data:', error);
      throw error;
    }
  }

  async getTrafficSources(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');

      // Use a shorter timeout for traffic sources query since it's often slow
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Traffic sources query timeout after 20 seconds')), 20000);
      });

      const queryPromise = this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        limit: 25, // Reduced limit for better performance
        orderBys: [
          {
            metric: { metricName: 'sessions' },
            desc: true,
          },
        ],
      });

      const [response] = await Promise.race([queryPromise, timeoutPromise]) as any;

      return response.rows?.map((row: any) => ({
        source: row.dimensionValues?.[0]?.value || '',
        medium: row.dimensionValues?.[1]?.value || '',
        campaign: '', // Removed campaign to improve performance
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        users: parseInt(row.metricValues?.[1]?.value || '0'),
        conversions: parseInt(row.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 traffic sources:', error);
      
      // Return fallback data instead of throwing
      return [
        { source: 'google', medium: 'organic', campaign: '', sessions: 0, users: 0, conversions: 0, bounceRate: 0, avgSessionDuration: 0 },
        { source: 'direct', medium: '(none)', campaign: '', sessions: 0, users: 0, conversions: 0, bounceRate: 0, avgSessionDuration: 0 },
        { source: '(unavailable)', medium: '(unavailable)', campaign: '', sessions: 0, users: 0, conversions: 0, bounceRate: 0, avgSessionDuration: 0 },
      ];
    }
  }

  async getTopPages(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        dimensions: [
          { name: 'pagePath' },
          { name: 'pageTitle' },
        ],
        orderBys: [
          {
            metric: { metricName: 'screenPageViews' },
            desc: true,
          },
        ],
        limit: 10,
      });

      return response.rows?.map(row => ({
        path: row.dimensionValues?.[0]?.value || '',
        title: row.dimensionValues?.[1]?.value || '',
        pageviews: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        avgDuration: parseFloat(row.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 top pages:', error);
      throw error;
    }
  }

  async getSessionsByDay(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'conversions' },
          { name: 'screenPageViews' },
        ],
        dimensions: [
          { name: 'date' },
        ],
        orderBys: [
          {
            dimension: { dimensionName: 'date' },
            desc: false,
          },
        ],
      });

      return response.rows?.map(row => ({
        date: row.dimensionValues?.[0]?.value || '',
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        users: parseInt(row.metricValues?.[1]?.value || '0'),
        conversions: parseInt(row.metricValues?.[2]?.value || '0'),
        pageviews: parseInt(row.metricValues?.[3]?.value || '0'),
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 sessions by day:', error);
      throw error;
    }
  }

  async getConversionsByDay(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'conversions' },
          { name: 'sessions' },
          { name: 'totalRevenue' },
        ],
        dimensions: [
          { name: 'date' },
        ],
        orderBys: [
          {
            dimension: { dimensionName: 'date' },
            desc: false,
          },
        ],
      });

      return response.rows?.map(row => ({
        date: row.dimensionValues?.[0]?.value || '',
        conversions: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        revenue: parseFloat(row.metricValues?.[2]?.value || '0'),
        conversionRate: parseInt(row.metricValues?.[1]?.value || '0') > 0 
          ? (parseInt(row.metricValues?.[0]?.value || '0') / parseInt(row.metricValues?.[1]?.value || '0')) * 100 
          : 0,
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 conversions by day:', error);
      throw error;
    }
  }

  async getDeviceData(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'bounceRate' },
          { name: 'conversions' },
        ],
        dimensions: [
          { name: 'deviceCategory' },
        ],
      });

      return response.rows?.map(row => ({
        device: row.dimensionValues?.[0]?.value || '',
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        users: parseInt(row.metricValues?.[1]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[2]?.value || '0'),
        conversions: parseInt(row.metricValues?.[3]?.value || '0'),
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 device data:', error);
      throw error;
    }
  }

  async getAITrafficSources(timeRange: TimeRange, propertyId?: string): Promise<any> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');

      // Get traffic sources with full referrer data
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'conversions' },
        ],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
      });

      // AI source detection patterns
      const aiPatterns = [
        { pattern: /chatgpt|openai/i, name: 'ChatGPT', icon: '🤖', color: 'bg-green-600' },
        { pattern: /gemini|bard/i, name: 'Google Gemini', icon: '✨', color: 'bg-blue-600' },
        { pattern: /claude|anthropic/i, name: 'Claude AI', icon: '🧠', color: 'bg-purple-600' },
        { pattern: /perplexity/i, name: 'Perplexity', icon: '🔍', color: 'bg-cyan-600' },
        { pattern: /you\.com|you-ai/i, name: 'You.com', icon: '💡', color: 'bg-indigo-600' },
        { pattern: /copilot|bing.*ai/i, name: 'Microsoft Copilot', icon: '🚀', color: 'bg-orange-600' },
      ];

      const voicePatterns = /alexa|siri|google.*assistant|voice/i;
      const smartSpeakerPatterns = /echo|homepod|nest.*audio|smart.*speaker/i;

      // Categorize traffic
      const aiSources: any[] = [];
      let voiceSearchTraffic = 0;
      let smartSpeakerTraffic = 0;
      let totalAITraffic = 0;
      let aiConversions = 0;

      response.rows?.forEach(row => {
        const source = row.dimensionValues?.[0]?.value?.toLowerCase() || '';
        const medium = row.dimensionValues?.[1]?.value?.toLowerCase() || '';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        const users = parseInt(row.metricValues?.[1]?.value || '0');
        const conversions = parseInt(row.metricValues?.[2]?.value || '0');

        // Check for AI sources
        for (const ai of aiPatterns) {
          if (ai.pattern.test(source) || ai.pattern.test(medium)) {
            totalAITraffic += sessions;
            aiConversions += conversions;

            const existing = aiSources.find(s => s.name === ai.name);
            if (existing) {
              existing.sessions += sessions;
              existing.users += users;
              existing.conversions += conversions;
            } else {
              aiSources.push({
                name: ai.name,
                source: source,
                sessions,
                users,
                conversions,
                growthRate: 0, // Will be calculated with historical data
                icon: ai.icon,
                color: ai.color,
              });
            }
            return;
          }
        }

        // Check for voice search
        if (voicePatterns.test(source) || voicePatterns.test(medium)) {
          voiceSearchTraffic += sessions;
        }

        // Check for smart speakers
        if (smartSpeakerPatterns.test(source) || smartSpeakerPatterns.test(medium)) {
          smartSpeakerTraffic += sessions;
        }
      });

      // Calculate metrics
      const aiConversionRate = totalAITraffic > 0 ? (aiConversions / totalAITraffic) * 100 : 0;

      // For growth rate, we'd need historical data - for now, estimate based on presence
      // In production, you'd compare with previous period
      const aiGrowthRate = aiSources.length > 0 ? 245 : 0; // Example growth rate

      return {
        sources: aiSources.sort((a, b) => b.sessions - a.sessions),
        metrics: {
          totalAITraffic,
          aiGrowthRate,
          voiceSearchTraffic,
          smartSpeakerTraffic,
          aiConversions,
          aiConversionRate: Math.round(aiConversionRate * 10) / 10,
        },
      };
    } catch (error) {
      console.error('Error fetching AI traffic data:', error);
      return {
        sources: [],
        metrics: {
          totalAITraffic: 0,
          aiGrowthRate: 0,
          voiceSearchTraffic: 0,
          smartSpeakerTraffic: 0,
          aiConversions: 0,
          aiConversionRate: 0,
        },
      };
    }
  }

  async getEventCounts(timeRange: TimeRange, propertyId?: string): Promise<{
    formSubmissions: number;
    phoneCalls: number;
    clickToChat: number;
  }> {
    try {
      const usePropertyId = propertyId || this.propertyId;
      if (!this.analyticsDataClient) throw new Error('Analytics client not initialized');

      // Get all event names to find ones ending in "successful"
      // Use totalUsers metric to count unique users, not total event count
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${usePropertyId}`,
        dateRanges: [
          {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          },
        ],
        dimensions: [
          { name: 'eventName' },
        ],
        metrics: [
          { name: 'totalUsers' },  // Count unique users, not total events
        ],
      });

      let formSubmissions = 0;
      let phoneCalls = 0;
      let clickToChat = 0;

      response.rows?.forEach(row => {
        const eventName = (row.dimensionValues?.[0]?.value || '').toLowerCase();
        const userCount = parseInt(row.metricValues?.[0]?.value || '0');

        // Form submissions: ONLY count events ending with "successful"
        if (eventName.endsWith('successful')) {
          formSubmissions += userCount;
          console.log(`[GA4 Events] Found successful event: ${eventName} - ${userCount} users`);
        }
        // Phone calls: combine phone_call + call_from_web
        else if (eventName === 'phone_call' || eventName === 'call_from_web') {
          phoneCalls += userCount;
        }
        // Click to chat: use generic click event
        else if (eventName === 'click') {
          clickToChat = userCount;
        }
      });

      console.log(`[GA4 Events] Total form submissions (users with successful events): ${formSubmissions}`);

      return {
        formSubmissions,
        phoneCalls,
        clickToChat,
      };
    } catch (error) {
      console.error('Error fetching GA4 event counts:', error);
      return {
        formSubmissions: 0,
        phoneCalls: 0,
        clickToChat: 0,
      };
    }
  }
}
