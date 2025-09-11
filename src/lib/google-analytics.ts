import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GAReport, GAMetrics, TimeRange } from '@/types';

export class GoogleAnalyticsConnector {
  private analyticsDataClient: BetaAnalyticsDataClient;
  private propertyId: string;

  constructor() {
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
    this.propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '';
  }

  async getBasicMetrics(timeRange: TimeRange, propertyId?: string): Promise<GAReport> {
    try {
      const usePropertyId = propertyId || this.propertyId;
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

      const metrics: GAMetrics = {
        sessions: parseInt(response.rows?.[0]?.metricValues?.[0]?.value || '0'),
        users: parseInt(response.rows?.[0]?.metricValues?.[1]?.value || '0'),
        pageviews: parseInt(response.rows?.[0]?.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(response.rows?.[0]?.metricValues?.[3]?.value || '0'),
        sessionDuration: parseFloat(response.rows?.[0]?.metricValues?.[4]?.value || '0'),
        conversions: parseInt(response.rows?.[0]?.metricValues?.[5]?.value || '0'),
        goalCompletions: parseInt(response.rows?.[0]?.metricValues?.[5]?.value || '0'),
        ecommerce: {
          revenue: parseFloat(response.rows?.[0]?.metricValues?.[6]?.value || '0'),
          transactions: parseInt(response.rows?.[0]?.metricValues?.[7]?.value || '0'),
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
      })) || [];
    } catch (error) {
      console.error('Error fetching GA4 traffic sources:', error);
      
      // Return fallback data instead of throwing
      return [
        { source: 'google', medium: 'organic', campaign: '', sessions: 0, users: 0, conversions: 0 },
        { source: 'direct', medium: '(none)', campaign: '', sessions: 0, users: 0, conversions: 0 },
        { source: '(unavailable)', medium: '(unavailable)', campaign: '', sessions: 0, users: 0, conversions: 0 },
      ];
    }
  }

  async getConversionsByDay(timeRange: TimeRange, propertyId?: string): Promise<any[]> {
    try {
      const usePropertyId = propertyId || this.propertyId;
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
}
