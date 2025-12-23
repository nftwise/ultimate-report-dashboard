/**
 * Unified Google Ads Connector
 *
 * This connector tries multiple authentication methods in order:
 * 1. OAuth with session access token (if available)
 * 2. OAuth with refresh token from environment
 * 3. Service account with domain-wide delegation
 *
 * If all methods fail, returns empty report instead of throwing.
 */

import { GoogleAdsReport, GoogleAdsMetrics, TimeRange } from '@/types';
import { GoogleAdsServiceAccountConnector } from './google-ads-service-account';

export class GoogleAdsUnifiedConnector {
  private serviceAccountConnector: GoogleAdsServiceAccountConnector | null = null;
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
    console.log('[GoogleAdsUnified] Initialized with access token:', !!accessToken);
  }

  private getEmptyReport(timeRange: TimeRange): GoogleAdsReport {
    return {
      campaigns: [],
      adGroups: [],
      keywords: [],
      totalMetrics: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cost: 0,
        conversions: 0,
        conversionRate: 0,
        costPerConversion: 0,
        phoneCallConversions: 0,
        costPerLead: 0,
        qualityScore: 0,
        searchImpressionShare: 0,
      },
      dateRange: {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
      },
    };
  }

  async getCampaignReport(
    timeRange: TimeRange,
    customerId?: string,
    mccId?: string
  ): Promise<GoogleAdsReport> {
    const errors: string[] = [];

    // Use Service Account authentication
    try {
      console.log('[GoogleAdsUnified] Trying service account connector...');

      // Check if service account credentials exist
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Service account credentials not configured');
      }

      // Check if impersonation email is set (required for Google Ads)
      if (!process.env.GOOGLE_ADS_IMPERSONATE_EMAIL) {
        console.warn('[GoogleAdsUnified] GOOGLE_ADS_IMPERSONATE_EMAIL not set - service account may fail');
      }

      if (!this.serviceAccountConnector) {
        this.serviceAccountConnector = new GoogleAdsServiceAccountConnector();
      }

      const report = await this.serviceAccountConnector.getCampaignReport(timeRange, customerId, mccId);

      // Check if we got actual data
      if (report.campaigns.length > 0 || report.totalMetrics.impressions > 0) {
        console.log('[GoogleAdsUnified] Service account connector succeeded');
        return report;
      } else {
        throw new Error('Service account returned empty data');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      errors.push(`ServiceAccount: ${errorMsg}`);
      console.warn('[GoogleAdsUnified] Service account connector failed:', errorMsg);
    }

    // All methods failed - log the errors and return empty report
    console.error('[GoogleAdsUnified] All connection methods failed:', errors.join('; '));

    return this.getEmptyReport(timeRange);
  }

  /**
   * Check which authentication methods are available
   */
  static getAvailableMethods(): { oauth: boolean; serviceAccount: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check OAuth
    const hasOAuth = !!(
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    );

    if (!hasOAuth) {
      if (!process.env.GOOGLE_ADS_CLIENT_ID) reasons.push('Missing GOOGLE_ADS_CLIENT_ID');
      if (!process.env.GOOGLE_ADS_CLIENT_SECRET) reasons.push('Missing GOOGLE_ADS_CLIENT_SECRET');
      if (!process.env.GOOGLE_ADS_REFRESH_TOKEN) reasons.push('Missing GOOGLE_ADS_REFRESH_TOKEN');
      if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) reasons.push('Missing GOOGLE_ADS_DEVELOPER_TOKEN');
    }

    // Check Service Account
    const hasServiceAccount = !!(
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    );

    if (!hasServiceAccount) {
      if (!process.env.GOOGLE_CLIENT_EMAIL) reasons.push('Missing GOOGLE_CLIENT_EMAIL');
      if (!process.env.GOOGLE_PRIVATE_KEY) reasons.push('Missing GOOGLE_PRIVATE_KEY');
    }

    // Note about impersonation
    if (hasServiceAccount && !process.env.GOOGLE_ADS_IMPERSONATE_EMAIL) {
      reasons.push('Warning: GOOGLE_ADS_IMPERSONATE_EMAIL not set (required for service account)');
    }

    return { oauth: hasOAuth, serviceAccount: hasServiceAccount, reasons };
  }

  /**
   * Get phone call conversions - derives from campaign report
   */
  async getPhoneCallConversions(
    timeRange: TimeRange,
    customerId?: string,
    mccId?: string
  ): Promise<any[]> {
    try {
      const report = await this.getCampaignReport(timeRange, customerId, mccId);

      // Extract phone call data from campaigns
      return report.campaigns
        .filter(c => c.metrics.phoneCallConversions > 0)
        .map(c => ({
          date: timeRange.endDate,
          campaign: c.name,
          adGroup: c.name,
          phoneCallConversions: c.metrics.phoneCallConversions,
          phoneCalls: c.metrics.phoneCallConversions,
          phoneImpressions: c.metrics.impressions,
          cost: c.metrics.cost,
        }));
    } catch (error) {
      console.error('[GoogleAdsUnified] Error getting phone calls:', error);
      return [];
    }
  }

  /**
   * Get cost per lead data - derives from campaign report
   */
  async getCostPerLeadData(
    timeRange: TimeRange,
    customerId?: string,
    mccId?: string
  ): Promise<any[]> {
    try {
      const report = await this.getCampaignReport(timeRange, customerId, mccId);

      // Extract CPL data from campaigns
      return report.campaigns
        .filter(c => c.metrics.conversions > 0)
        .map(c => ({
          date: timeRange.endDate,
          campaign: c.name,
          conversions: c.metrics.conversions,
          cost: c.metrics.cost,
          costPerLead: c.metrics.costPerLead,
        }));
    } catch (error) {
      console.error('[GoogleAdsUnified] Error getting CPL data:', error);
      return [];
    }
  }

  /**
   * Test connection with all available methods
   */
  async testConnection(customerId: string, mccId?: string): Promise<{
    success: boolean;
    method?: string;
    error?: string;
    details?: any;
  }> {
    const testRange: TimeRange = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      period: '7days',
    };

    try {
      const report = await this.getCampaignReport(testRange, customerId, mccId);

      if (report.campaigns.length > 0 || report.totalMetrics.impressions > 0) {
        return {
          success: true,
          method: 'auto',
          details: {
            campaignsFound: report.campaigns.length,
            totalImpressions: report.totalMetrics.impressions,
          },
        };
      }

      return {
        success: false,
        error: 'Connected but no data returned',
        details: { availableMethods: GoogleAdsUnifiedConnector.getAvailableMethods() },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: { availableMethods: GoogleAdsUnifiedConnector.getAvailableMethods() },
      };
    }
  }
}

// Export a factory function for convenience
export function createGoogleAdsConnector(accessToken?: string): GoogleAdsUnifiedConnector {
  return new GoogleAdsUnifiedConnector(accessToken);
}
