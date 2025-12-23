// Google Analytics Types
export interface GAMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  sessionDuration: number;
  conversions: number;
  goalCompletions: number;
  ecommerce?: {
    revenue: number;
    transactions: number;
  };
}

export interface GADimensions {
  date: string;
  country: string;
  city: string;
  source: string;
  medium: string;
  campaign: string;
  device: string;
  age: string;
  gender: string;
}

export interface GAReport {
  metrics: GAMetrics;
  dimensions: GADimensions[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// Google Ads Types
export interface GoogleAdsMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  phoneCallConversions: number;
  costPerLead: number;
  qualityScore: number;
  searchImpressionShare: number;
  searchBudgetLostImpressionShare?: number;
  topImpressionPercentage?: number;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  metrics: GoogleAdsMetrics;
  budget: {
    amount: number;
    currency: string;
  };
}

export interface GoogleAdsAdGroup {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  metrics: GoogleAdsMetrics;
}

export interface GoogleAdsKeyword {
  id: string;
  text: string;
  matchType: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  metrics: GoogleAdsMetrics;
  bid: number;
}

export interface GoogleAdsReport {
  campaigns: GoogleAdsCampaign[];
  adGroups: GoogleAdsAdGroup[];
  keywords: GoogleAdsKeyword[];
  totalMetrics: GoogleAdsMetrics;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// CallRail Types
export interface CallRailCall {
  id: string;
  phoneNumber: string;
  trackingNumber: string;
  callerNumber: string;
  duration: number;
  startTime: string;
  endTime: string;
  answered: boolean;
  firstCall: boolean;
  direction: 'inbound' | 'outbound';
  source: {
    name: string;
    referrer: string;
    medium: string;
    campaign: string;
    keyword: string;
    landing_page: string;
  };
  tags: string[];
  note: string;
  value: number;
  lead_status: 'good_lead' | 'not_lead' | 'unknown';
  recording_url?: string;
  transcription?: string;
}

export interface CallRailMetrics {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  totalDuration: number;
  averageDuration: number;
  firstTimeCalls: number;
  repeatCalls: number;
  conversions: number;
  conversionRate: number;
  totalValue: number;
  averageValue: number;
}

export interface CallRailTrackingNumber {
  id: string;
  name: string;
  phoneNumber: string;
  formattedNumber: string;
  status: 'active' | 'inactive';
  type: 'local' | 'tollfree';
  assignedTo?: string;
  whisperMessage?: string;
  destinationNumber: string;
  smsEnabled: boolean;
  tags: string[];
}

export interface CallRailReport {
  calls: CallRailCall[];
  trackingNumbers: CallRailTrackingNumber[];
  metrics: CallRailMetrics;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// Combined Dashboard Types
export interface DashboardMetrics {
  googleAnalytics: GAReport;
  googleAds: GoogleAdsReport;
  callRail: CallRailReport;
  gaEvents?: {
    formSubmissions: number;
    phoneCalls: number;
    clickToChat: number;
  };
  combined: {
    totalTrafficSessions: number;
    totalAdSpend: number;
    totalPhoneCalls: number;
    totalConversions: number;
    overallCostPerLead: number;
    overallROI: number;
    phoneCallConversionRate: number;
    attributedPhoneCalls: number;
  };
  // Period comparison metrics (percentage changes)
  comparison?: {
    trafficChange: number;      // % change in sessions
    leadsChange: number;         // % change in conversions
    phoneCallsChange: number;    // % change in phone calls
    spendChange: number;         // % change in ad spend
    cplChange: number;           // % change in cost per lead
  };
}

export interface TimeRange {
  startDate: string;
  endDate: string;
  period: 'today' | '7days' | '30days' | '90days' | 'custom';
}

export interface DashboardFilters {
  timeRange: TimeRange;
  campaigns?: string[];
  sources?: string[];
  devices?: string[];
  trackingNumbers?: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  cached: boolean;
}

// Chart Data Types
export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  dataKeys: string[];
  colors: string[];
  yAxisLabel?: string;
  xAxisLabel?: string;
}

// Google Business Profile Types
export interface GBPMetrics {
  searchQueries: {
    direct: number;        // Customers searched for your business name/address
    indirect: number;      // Customers found you via category/service searches
    total: number;
  };
  views: {
    search: number;        // Views from Google Search
    maps: number;          // Views from Google Maps
    total: number;
  };
  actions: {
    website: number;       // Clicks to your website
    phone: number;         // Phone calls from profile
    directions: number;    // Direction requests
    total: number;
  };
  photos: {
    merchantViews: number; // Views of business-uploaded photos
    customerViews: number; // Views of customer-uploaded photos
    totalViews: number;
  };
}

export interface GBPReport {
  locationId: string;
  timeRange: TimeRange;
  metrics: GBPMetrics;
  raw?: any;
}