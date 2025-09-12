import { GoogleAdsApi } from 'google-ads-api';
import { GoogleAdsReport, GoogleAdsCampaign, GoogleAdsAdGroup, GoogleAdsKeyword, GoogleAdsMetrics, TimeRange } from '@/types';

export class GoogleAdsConnector {
  private client: GoogleAdsApi;
  private customerId: string;

  constructor() {
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });
    this.customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000, operationName: string = 'Google Ads API call'): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error: any) {
      if (error.message?.includes('developer token') || error.message?.includes('test accounts')) {
        throw new Error('Google Ads API authentication failed - developer token not approved');
      }
      throw error;
    }
  }

  private getCustomer() {
    return this.client.Customer({
      customer_id: this.customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    });
  }

  private formatDate(date: string): string {
    return date.replace(/-/g, '');
  }

  private formatMetrics(metrics: any): GoogleAdsMetrics {
    return {
      impressions: parseInt(metrics.impressions || '0'),
      clicks: parseInt(metrics.clicks || '0'),
      ctr: parseFloat(metrics.ctr || '0'),
      cpc: parseFloat(metrics.average_cpc || '0') / 1000000, // Convert from micros
      cost: parseFloat(metrics.cost_micros || '0') / 1000000, // Convert from micros
      conversions: parseFloat(metrics.conversions || '0'),
      conversionRate: parseFloat(metrics.conversions_from_interactions_rate || '0'),
      costPerConversion: parseFloat(metrics.cost_per_conversion || '0') / 1000000,
      phoneCallConversions: parseFloat(metrics.phone_call_conversions || '0'),
      costPerLead: parseFloat(metrics.cost_per_conversion || '0') / 1000000,
      qualityScore: parseFloat(metrics.quality_score || '0'),
      searchImpressionShare: parseFloat(metrics.search_impression_share || '0'),
    };
  }

  private cleanCustomerId(customerId: string | undefined): string {
    if (!customerId || customerId === '') {
      return '';
    }
    // Remove hyphens and any spaces from customer ID (e.g., "123-456-7890" -> "1234567890")
    return customerId.replace(/-|\s/g, '');
  }

  async getCampaignReport(timeRange: TimeRange, customerId?: string): Promise<GoogleAdsReport> {
    try {
      const rawCustomerId = customerId || this.customerId;
      const cleanCustomerId = this.cleanCustomerId(rawCustomerId);
      
      if (!cleanCustomerId) {
        // Return empty report if no customer ID
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
          dateRange: timeRange,
        };
      }

      const customer = this.client.Customer({
        customer_id: cleanCustomerId,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      });
      
      // Get campaign data
      const campaignQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.campaign_budget.amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_from_interactions_rate,
          metrics.cost_per_conversion,
          metrics.phone_call_conversions,
          metrics.search_impression_share
        FROM campaign
        WHERE
          segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND campaign.status != 'REMOVED'
      `;

      const campaignResults = await this.withTimeout(
        customer.query(campaignQuery),
        5000,
        'Campaign query'
      );
      
      const campaigns: GoogleAdsCampaign[] = campaignResults.map((row: any) => ({
        id: row.campaign.id.toString(),
        name: row.campaign.name,
        status: row.campaign.status,
        type: 'SEARCH', // Default to SEARCH for now
        metrics: this.formatMetrics(row.metrics),
        budget: {
          amount: parseFloat(row.campaign.campaign_budget.amount_micros || '0') / 1000000,
          currency: 'USD', // Default to USD
        },
      }));

      // Get ad group data
      const adGroupQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          campaign.id,
          campaign.name,
          ad_group.status,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_from_interactions_rate,
          metrics.cost_per_conversion,
          metrics.phone_call_conversions
        FROM ad_group
        WHERE
          segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND ad_group.status != 'REMOVED'
      `;

      const adGroupResults = await this.withTimeout(
        customer.query(adGroupQuery),
        5000,
        'Ad group query'
      );
      
      const adGroups: GoogleAdsAdGroup[] = adGroupResults.map((row: any) => ({
        id: row.ad_group.id.toString(),
        name: row.ad_group.name,
        campaignId: row.campaign.id.toString(),
        campaignName: row.campaign.name,
        status: row.ad_group.status,
        metrics: this.formatMetrics(row.metrics),
      }));

      // Get keyword data
      const keywordQuery = `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group.id,
          ad_group.name,
          campaign.id,
          campaign.name,
          ad_group_criterion.cpc_bid_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_from_interactions_rate,
          metrics.cost_per_conversion,
          metrics.quality_score
        FROM keyword_view
        WHERE
          segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
      `;

      const keywordResults = await this.withTimeout(
        customer.query(keywordQuery),
        5000,
        'Keyword query'
      );
      
      const keywords: GoogleAdsKeyword[] = keywordResults.map((row: any) => ({
        id: `${row.ad_group.id}_${row.ad_group_criterion.keyword.text}`,
        text: row.ad_group_criterion.keyword.text,
        matchType: row.ad_group_criterion.keyword.match_type,
        adGroupId: row.ad_group.id.toString(),
        adGroupName: row.ad_group.name,
        campaignId: row.campaign.id.toString(),
        campaignName: row.campaign.name,
        metrics: this.formatMetrics(row.metrics),
        bid: parseFloat(row.ad_group_criterion.cpc_bid_micros || '0') / 1000000,
      }));

      // Calculate total metrics
      const totalMetrics = this.calculateTotalMetrics(campaigns);

      return {
        campaigns,
        adGroups,
        keywords,
        totalMetrics,
        dateRange: {
          startDate: timeRange.startDate,
          endDate: timeRange.endDate,
        },
      };

    } catch (error) {
      console.error('Error fetching Google Ads data:', error);
      throw error;
    }
  }

  private calculateTotalMetrics(campaigns: GoogleAdsCampaign[]): GoogleAdsMetrics {
    const totals = campaigns.reduce((acc, campaign) => {
      acc.impressions += campaign.metrics.impressions;
      acc.clicks += campaign.metrics.clicks;
      acc.cost += campaign.metrics.cost;
      acc.conversions += campaign.metrics.conversions;
      acc.phoneCallConversions += campaign.metrics.phoneCallConversions;
      return acc;
    }, {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      phoneCallConversions: 0,
    });

    return {
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
      cost: totals.cost,
      conversions: totals.conversions,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
      costPerConversion: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
      phoneCallConversions: totals.phoneCallConversions,
      costPerLead: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
      qualityScore: 0, // Would need separate calculation
      searchImpressionShare: 0, // Would need separate calculation
    };
  }

  async getPhoneCallConversions(timeRange: TimeRange, customerId?: string): Promise<any[]> {
    try {
      const rawCustomerId = customerId || this.customerId;
      const cleanCustomerId = this.cleanCustomerId(rawCustomerId);
      
      if (!cleanCustomerId) {
        return [];
      }

      const customer = this.client.Customer({
        customer_id: cleanCustomerId,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      });
      
      const query = `
        SELECT
          campaign.name,
          ad_group.name,
          segments.date,
          metrics.phone_call_conversions,
          metrics.phone_calls,
          metrics.phone_impressions,
          metrics.cost_micros
        FROM campaign
        WHERE
          segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND metrics.phone_call_conversions > 0
        ORDER BY segments.date DESC
      `;

      const results = await this.withTimeout(
        customer.query(query),
        5000,
        'Phone call conversions query'
      );
      
      return results.map((row: any) => ({
        date: row.segments.date,
        campaign: row.campaign.name,
        adGroup: row.ad_group.name,
        phoneCallConversions: parseFloat(row.metrics.phone_call_conversions || '0'),
        phoneCalls: parseInt(row.metrics.phone_calls || '0'),
        phoneImpressions: parseInt(row.metrics.phone_impressions || '0'),
        cost: parseFloat(row.metrics.cost_micros || '0') / 1000000,
      }));

    } catch (error) {
      console.error('Error fetching phone call conversions:', error);
      throw error;
    }
  }

  async getCostPerLeadData(timeRange: TimeRange, customerId?: string): Promise<any[]> {
    try {
      const rawCustomerId = customerId || this.customerId;
      const cleanCustomerId = this.cleanCustomerId(rawCustomerId);
      
      if (!cleanCustomerId) {
        return [];
      }

      const customer = this.client.Customer({
        customer_id: cleanCustomerId,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      });
      
      const query = `
        SELECT
          campaign.name,
          segments.date,
          metrics.conversions,
          metrics.cost_micros,
          metrics.cost_per_conversion
        FROM campaign
        WHERE
          segments.date >= '${this.formatDate(timeRange.startDate)}'
          AND segments.date <= '${this.formatDate(timeRange.endDate)}'
          AND metrics.conversions > 0
        ORDER BY segments.date DESC
      `;

      const results = await this.withTimeout(
        customer.query(query),
        5000,
        'Cost per lead query'
      );
      
      return results.map((row: any) => ({
        date: row.segments.date,
        campaign: row.campaign.name,
        conversions: parseFloat(row.metrics.conversions || '0'),
        cost: parseFloat(row.metrics.cost_micros || '0') / 1000000,
        costPerLead: parseFloat(row.metrics.cost_per_conversion || '0') / 1000000,
      }));

    } catch (error) {
      console.error('Error fetching cost per lead data:', error);
      throw error;
    }
  }
}