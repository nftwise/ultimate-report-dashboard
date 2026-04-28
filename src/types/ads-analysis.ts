/**
 * Google Ads Analysis - TypeScript Type Definitions
 */

export type InsightType = 'warning' | 'opportunity' | 'recommendation' | 'critical';
export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InsightCategory = 'quality_score' | 'budget' | 'ctr' | 'conversions' | 'wasted_spend' | 'impression_share';
export type InsightStatus = 'active' | 'resolved' | 'dismissed' | 'in_progress';

// Campaign Metrics
export interface AdsCampaignMetric {
  id: string;
  client_id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string;
  date: string;

  // Performance
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value?: number;

  // Calculated
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;

  // Quality
  quality_score?: number;
  impression_share?: number;
  search_impression_share?: number;
  search_lost_is_budget?: number;
  search_lost_is_rank?: number;

  created_at: string;
  updated_at: string;
}

// Keyword Metrics
export interface AdsKeywordMetric {
  id: string;
  client_id: string;
  campaign_id: string;
  ad_group_id?: string;
  keyword: string;
  match_type?: string;
  date: string;

  // Performance
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;

  // Calculated
  ctr?: number;
  cpc?: number;
  cpa?: number;

  // Quality
  quality_score?: number;

  created_at: string;
}

// Insights
export interface AdsInsight {
  id: string;
  client_id: string;
  campaign_id?: string;
  ad_group_id?: string;
  keyword?: string;

  insight_type: InsightType;
  severity: InsightSeverity;
  category: InsightCategory;

  title: string;
  description: string;
  suggested_action?: string;

  metric_name?: string;
  metric_value?: number;
  threshold_value?: number;
  impact_estimate?: number; // $ impact

  status: InsightStatus;
  resolved_at?: string;
  resolved_by?: string;

  detected_at: string;
  created_at: string;
  updated_at: string;
}

// Account Health
export interface AdsAccountHealth {
  id: string;
  client_id: string;
  date: string;

  health_score: number; // 0-100

  // Component scores
  quality_score_rating?: number;
  performance_rating?: number;
  budget_efficiency_rating?: number;
  conversion_rating?: number;

  // Counts
  total_campaigns: number;
  active_campaigns: number;
  total_active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;

  created_at: string;
}

// Ad Group Metrics
export interface AdsAdGroupMetric {
  id: string;
  client_id: string;
  campaign_id: string;
  ad_group_id: string;
  ad_group_name: string;
  date: string;

  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;

  ctr?: number;
  cpc?: number;
  cpa?: number;

  created_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface AdsAnalysisDashboardData {
  client: {
    id: string;
    name: string;
    slug: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  healthScore: AdsAccountHealth | null;
  campaigns: AdsCampaignMetric[];
  insights: AdsInsight[];
  summary: {
    totalSpend: number;
    totalConversions: number;
    totalClicks: number;
    totalImpressions: number;
    avgCPC: number;
    avgCPA: number;
    avgCTR: number;
    avgROAS: number;
  };
}

export interface CampaignDetailsData {
  campaign: AdsCampaignMetric;
  keywords: AdsKeywordMetric[];
  adGroups: AdsAdGroupMetric[];
  insights: AdsInsight[];
  history: AdsCampaignMetric[]; // Historical data
}

export interface InsightsListData {
  insights: AdsInsight[];
  counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byCategory: Record<InsightCategory, number>;
}

// ============================================
// Google Ads API Response Types
// ============================================

export interface GoogleAdsCampaignData {
  customerId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  metrics: {
    impressions: string;
    clicks: string;
    cost_micros: string;
    conversions: string;
    conversions_value: string;
    ctr: string;
    average_cpc: string;
    average_cost: string;
    search_impression_share?: string;
    search_budget_lost_impression_share?: string;
    search_rank_lost_impression_share?: string;
  };
  qualityScore?: number;
}

export interface GoogleAdsKeywordData {
  customerId: string;
  campaignId: string;
  adGroupId: string;
  keywordText: string;
  matchType: string;
  metrics: {
    impressions: string;
    clicks: string;
    cost_micros: string;
    conversions: string;
  };
  qualityScore?: number;
}

// ============================================
// Insight Detection Types
// ============================================

export interface InsightDetectionRule {
  id: string;
  name: string;
  category: InsightCategory;
  severity: InsightSeverity;
  condition: (campaign: AdsCampaignMetric, baseline?: AdsCampaignMetric[]) => boolean;
  generateInsight: (campaign: AdsCampaignMetric) => Omit<AdsInsight, 'id' | 'created_at' | 'updated_at'>;
}

export interface InsightDetectionResult {
  detectedInsights: AdsInsight[];
  totalChecks: number;
  triggeredRules: string[];
}
