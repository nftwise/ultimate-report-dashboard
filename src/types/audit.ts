// ============================================
// AUDIT SYSTEM - TYPESCRIPT TYPES
// ============================================
// Auto-generated types for database tables
// ============================================

export type AuditType = 'local_seo' | 'technical_seo' | 'content_audit' | 'competitor_analysis'
export type AuditStatus = 'completed' | 'in_progress' | 'scheduled'
export type ActionItemPriority = 'high' | 'medium' | 'low'
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ActionItemCategory =
  | 'review_generation'
  | 'gbp_optimization'
  | 'citations'
  | 'content'
  | 'technical'
  | 'link_building'
  | 'social_media'
export type MetricPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

// ============================================
// Category Scores
// ============================================
export interface CategoryScores {
  google_business_profile?: number
  online_reviews?: number
  technical_seo?: number
  citations?: number
  local_visibility?: number
  content_quality?: number
  backlinks?: number
  social_signals?: number
  mobile_optimization?: number
  [key: string]: number | undefined // Allow custom categories
}

// ============================================
// Audit Metrics (Snapshot at time of audit)
// ============================================
export interface AuditMetrics {
  // Review metrics
  google_reviews?: number
  review_rating?: number
  yelp_reviews?: number
  yelp_rating?: number
  total_reviews?: number
  avg_rating?: number

  // Citation metrics
  citations_count?: number
  nap_consistency?: number

  // Ranking metrics
  local_ranking?: number
  organic_position?: number

  // GBP metrics
  gbp_views?: number
  gbp_actions?: number
  gbp_calls?: number

  // Website metrics
  website_traffic?: number
  organic_traffic?: number
  conversions?: number

  // Allow custom metrics
  [key: string]: number | string | undefined
}

// ============================================
// Competitor Data
// ============================================
export interface Competitor {
  name: string
  rating?: number
  reviews?: number
  ranking?: number
  website?: string
  address?: string
  phone?: string
  strengths?: string[]
  weaknesses?: string[]
}

// ============================================
// CLIENT AUDIT
// ============================================
export interface ClientAudit {
  id: string
  client_id: string
  audit_type: AuditType
  audit_date: string
  auditor_name?: string
  status: AuditStatus
  overall_score?: number
  category_scores?: CategoryScores
  metrics?: AuditMetrics
  competitors?: Competitor[]
  findings?: string
  summary?: string
  next_audit_date?: string
  created_at: string
  updated_at: string
}

export interface ClientAuditInsert {
  client_id: string
  audit_type?: AuditType
  audit_date?: string
  auditor_name?: string
  status?: AuditStatus
  overall_score?: number
  category_scores?: CategoryScores
  metrics?: AuditMetrics
  competitors?: Competitor[]
  findings?: string
  summary?: string
  next_audit_date?: string
}

export interface ClientAuditUpdate {
  audit_type?: AuditType
  auditor_name?: string
  status?: AuditStatus
  overall_score?: number
  category_scores?: CategoryScores
  metrics?: AuditMetrics
  competitors?: Competitor[]
  findings?: string
  summary?: string
  next_audit_date?: string
}

// ============================================
// AUDIT ACTION ITEM
// ============================================
export interface AuditActionItem {
  id: string
  client_id: string
  audit_id: string
  title: string
  description?: string
  category?: ActionItemCategory
  priority: ActionItemPriority
  status: ActionItemStatus
  deadline?: string
  completed_date?: string
  estimated_hours?: number
  impact_score?: number
  expected_outcome?: string
  assigned_to?: string
  notes?: string
  resources_needed?: string
  created_at: string
  updated_at: string
}

export interface AuditActionItemInsert {
  client_id: string
  audit_id: string
  title: string
  description?: string
  category?: ActionItemCategory
  priority?: ActionItemPriority
  status?: ActionItemStatus
  deadline?: string
  completed_date?: string
  estimated_hours?: number
  impact_score?: number
  expected_outcome?: string
  assigned_to?: string
  notes?: string
  resources_needed?: string
}

export interface AuditActionItemUpdate {
  title?: string
  description?: string
  category?: ActionItemCategory
  priority?: ActionItemPriority
  status?: ActionItemStatus
  deadline?: string
  completed_date?: string
  estimated_hours?: number
  impact_score?: number
  expected_outcome?: string
  assigned_to?: string
  notes?: string
  resources_needed?: string
}

// ============================================
// AUDIT METRICS (Historical Tracking)
// ============================================
export interface AuditMetricsRecord {
  id: string
  client_id: string
  metric_date: string
  period: MetricPeriod

  // Review metrics
  google_reviews?: number
  google_rating?: number
  yelp_reviews?: number
  yelp_rating?: number
  total_reviews?: number
  avg_rating?: number
  new_reviews_count?: number
  review_response_rate?: number

  // Citation metrics
  citations_count?: number
  nap_consistency_score?: number

  // Ranking metrics
  local_pack_ranking?: number
  organic_ranking?: number

  // GBP metrics
  gbp_search_views?: number
  gbp_maps_views?: number
  gbp_total_actions?: number
  gbp_website_clicks?: number
  gbp_phone_calls?: number
  gbp_direction_requests?: number

  // Website metrics
  organic_traffic?: number
  local_traffic?: number
  conversion_rate?: number
  conversions?: number

  // Custom metrics
  custom_metrics?: Record<string, any>

  created_at: string
  updated_at: string
}

export interface AuditMetricsInsert {
  client_id: string
  metric_date: string
  period?: MetricPeriod
  google_reviews?: number
  google_rating?: number
  yelp_reviews?: number
  yelp_rating?: number
  total_reviews?: number
  avg_rating?: number
  new_reviews_count?: number
  review_response_rate?: number
  citations_count?: number
  nap_consistency_score?: number
  local_pack_ranking?: number
  organic_ranking?: number
  gbp_search_views?: number
  gbp_maps_views?: number
  gbp_total_actions?: number
  gbp_website_clicks?: number
  gbp_phone_calls?: number
  gbp_direction_requests?: number
  organic_traffic?: number
  local_traffic?: number
  conversion_rate?: number
  conversions?: number
  custom_metrics?: Record<string, any>
}

// ============================================
// VIEW TYPES
// ============================================
export interface LatestClientAudit extends ClientAudit {
  client_name: string
  client_slug: string
}

export interface PendingActionItem extends AuditActionItem {
  client_name: string
  client_slug: string
  audit_date: string
}

export interface ClientAuditProgress {
  client_id: string
  client_name: string
  audit_date: string
  overall_score?: number
  category_scores?: CategoryScores
  previous_score?: number
  score_change?: number
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface AuditSummary {
  audit: ClientAudit
  action_items: AuditActionItem[]
  metrics: AuditMetricsRecord | null
  progress?: {
    completed_items: number
    total_items: number
    percentage: number
  }
}

export interface ClientAuditHistory {
  client_id: string
  client_name: string
  audits: ClientAudit[]
  latest_score?: number
  score_trend: 'improving' | 'declining' | 'stable'
  total_action_items: number
  completed_action_items: number
}
