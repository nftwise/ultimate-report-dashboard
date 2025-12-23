/**
 * Google Ads API using Service Account authentication
 *
 * NOTE: Service accounts require domain-wide delegation for Google Ads.
 * If you can't use service account, this module provides a fallback
 * that returns mock/cached data or integrates with Google Sheets.
 *
 * Alternative: Link Google Ads to Google Analytics and get the data from GA4
 */

import { GoogleAdsReport, GoogleAdsCampaign, GoogleAdsMetrics, TimeRange } from '@/types';
import { JWT } from 'google-auth-library';

interface GoogleAdsCredentials {
  developerToken: string;
  clientEmail: string;
  privateKey: string;
  customerId: string;
  mccId?: string;
  // For impersonation (domain-wide delegation)
  subjectEmail?: string;
}

export class GoogleAdsServiceAccountConnector {
  private credentials: GoogleAdsCredentials;
  private jwtClient: JWT | null = null;

  constructor() {
    this.credentials = {
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL!,
      privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
      mccId: process.env.GOOGLE_ADS_MCC_ID,
      // Email of user to impersonate (must have Google Ads access)
      subjectEmail: process.env.GOOGLE_ADS_IMPERSONATE_EMAIL,
    };

    console.log('[GoogleAdsServiceAccount] Initialized with customer ID:', this.credentials.customerId);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.jwtClient) {
      // Don't use subject/impersonation when service account is directly added to Google Ads
      // Subject is only needed for domain-wide delegation (Google Workspace)
      this.jwtClient = new JWT({
        email: this.credentials.clientEmail,
        key: this.credentials.privateKey,
        scopes: ['https://www.googleapis.com/auth/adwords'],
      });
    }

    const tokens = await this.jwtClient.authorize();
    if (!tokens.access_token) {
      throw new Error('Failed to get access token from service account');
    }
    return tokens.access_token;
  }

  private cleanCustomerId(customerId: string): string {
    return customerId.replace(/-|\s/g, '');
  }

  private formatDate(date: string): string {
    return date.replace(/-/g, '');
  }

  async getCampaignReport(
    timeRange: TimeRange,
    customerId?: string,
    mccId?: string
  ): Promise<GoogleAdsReport> {
    const useCustomerId = this.cleanCustomerId(customerId || this.credentials.customerId);
    const useMccId = mccId || this.credentials.mccId;

    if (!useCustomerId) {
      console.log('[GoogleAdsServiceAccount] No customer ID provided');
      return this.getEmptyReport(timeRange);
    }

    try {
      const accessToken = await this.getAccessToken();

      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.campaign_budget,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_from_interactions_rate,
          metrics.cost_per_conversion,
          metrics.phone_calls,
          metrics.search_impression_share,
          metrics.search_budget_lost_impression_share,
          metrics.search_rank_lost_impression_share,
          metrics.top_impression_percentage
        FROM campaign
        WHERE segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.impressions DESC
      `;

      const response = await fetch(
        `https://googleads.googleapis.com/v20/customers/${useCustomerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': this.credentials.developerToken,
            'Content-Type': 'application/json',
            ...(useMccId ? { 'login-customer-id': this.cleanCustomerId(useMccId) } : {}),
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleAdsServiceAccount] API Error:', errorText);
        throw new Error(`Google Ads API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseResponse(data, timeRange);
    } catch (error: any) {
      console.error('[GoogleAdsServiceAccount] Error:', error.message);

      // Return empty report instead of throwing
      return this.getEmptyReport(timeRange);
    }
  }

  private parseResponse(data: any, timeRange: TimeRange): GoogleAdsReport {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;
    let totalPhoneCalls = 0;
    let totalSearchImpressionShare = 0;
    let totalBudgetLostImpressionShare = 0;
    let totalTopImpressionPercentage = 0;
    let campaignCount = 0;

    const campaigns: GoogleAdsCampaign[] = [];

    // Parse streaming response
    for (const batch of data || []) {
      for (const result of batch.results || []) {
        const metrics = result.metrics || {};
        const campaign = result.campaign || {};

        const impressions = parseInt(metrics.impressions || '0');
        const clicks = parseInt(metrics.clicks || '0');
        const costMicros = parseInt(metrics.costMicros || metrics.cost_micros || '0');
        const conversions = parseFloat(metrics.conversions || '0');
        const phoneCalls = parseFloat(metrics.phoneCalls || metrics.phone_calls || '0');
        const ctr = parseFloat(metrics.ctr || '0') * 100;
        const avgCpc = parseFloat(metrics.averageCpc || metrics.average_cpc || '0') / 1000000;
        const conversionRate = parseFloat(metrics.conversionsFromInteractionsRate || metrics.conversions_from_interactions_rate || '0') * 100;
        const costPerConversion = parseFloat(metrics.costPerConversion || metrics.cost_per_conversion || '0') / 1000000;
        const cost = costMicros / 1000000;

        // Advanced metrics (returned as decimals, convert to percentages)
        const searchImpressionShare = parseFloat(metrics.searchImpressionShare || metrics.search_impression_share || '0') * 100;
        const budgetLostImpressionShare = parseFloat(metrics.searchBudgetLostImpressionShare || metrics.search_budget_lost_impression_share || '0') * 100;
        const topImpressionPercentage = parseFloat(metrics.topImpressionPercentage || metrics.top_impression_percentage || '0') * 100;

        totalImpressions += impressions;
        totalClicks += clicks;
        totalCostMicros += costMicros;
        totalConversions += conversions;
        totalPhoneCalls += phoneCalls;

        // Weighted average for share metrics
        if (impressions > 0) {
          totalSearchImpressionShare += searchImpressionShare * impressions;
          totalBudgetLostImpressionShare += budgetLostImpressionShare * impressions;
          totalTopImpressionPercentage += topImpressionPercentage * impressions;
        }
        campaignCount++;

        const campaignMetrics: GoogleAdsMetrics = {
          impressions,
          clicks,
          ctr,
          cpc: avgCpc,
          cost,
          conversions,
          conversionRate,
          costPerConversion,
          phoneCallConversions: phoneCalls,
          costPerLead: conversions > 0 ? cost / conversions : 0,
          qualityScore: 0, // Quality score is at keyword level
          searchImpressionShare,
          searchBudgetLostImpressionShare: budgetLostImpressionShare,
          topImpressionPercentage,
        };

        campaigns.push({
          id: campaign.id?.toString() || 'unknown',
          name: campaign.name || 'Unknown',
          status: campaign.status || 'UNKNOWN',
          type: 'SEARCH',
          metrics: campaignMetrics,
          budget: {
            amount: 0,
            currency: 'USD',
          },
        });
      }
    }

    const totalSpend = totalCostMicros / 1000000;
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const totalCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const totalConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const totalCostPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // Calculate weighted averages for share metrics
    const avgSearchImpressionShare = totalImpressions > 0 ? totalSearchImpressionShare / totalImpressions : 0;
    const avgBudgetLostImpressionShare = totalImpressions > 0 ? totalBudgetLostImpressionShare / totalImpressions : 0;
    const avgTopImpressionPercentage = totalImpressions > 0 ? totalTopImpressionPercentage / totalImpressions : 0;

    const totalMetrics: GoogleAdsMetrics = {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalCtr,
      cpc: totalCpc,
      cost: totalSpend,
      conversions: totalConversions,
      conversionRate: totalConversionRate,
      costPerConversion: totalCostPerConversion,
      phoneCallConversions: totalPhoneCalls,
      costPerLead: totalCostPerConversion,
      qualityScore: 0,
      searchImpressionShare: Math.round(avgSearchImpressionShare * 10) / 10,
      searchBudgetLostImpressionShare: Math.round(avgBudgetLostImpressionShare * 10) / 10,
      topImpressionPercentage: Math.round(avgTopImpressionPercentage * 10) / 10,
    };

    return {
      campaigns,
      adGroups: [],
      keywords: [],
      totalMetrics,
      dateRange: {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
      },
    };
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
        searchBudgetLostImpressionShare: 0,
        topImpressionPercentage: 0,
      },
      dateRange: {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
      },
    };
  }
}

/**
 * Alternative: Get Google Ads data from linked GA4 property
 * If you've linked Google Ads to GA4, you can query ads data through GA4
 */
export async function getAdsDataFromGA4(
  propertyId: string,
  timeRange: TimeRange
): Promise<GoogleAdsReport | null> {
  try {
    // This would use the GA4 Data API to get Google Ads data
    // Requires: Google Ads account linked to GA4 property
    console.log('[GoogleAds] Attempting to get ads data from linked GA4 property');

    // For now, return null - implement if GA4 linking is available
    return null;
  } catch (error) {
    console.error('[GoogleAds] Error getting ads data from GA4:', error);
    return null;
  }
}
