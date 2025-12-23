-- Migration: Add 51 new columns to client_metrics_summary
-- Total metrics after migration: 59
-- Purpose: Support full team (Local SEO, Ads, AM, Content Writer)

-- =====================================================
-- TRAFFIC METRICS (GA4)
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS users INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_users INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic_organic INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic_paid INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic_direct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic_referral INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic_ai INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sessions_mobile INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sessions_desktop INTEGER DEFAULT 0;

-- =====================================================
-- SEO / SEARCH CONSOLE METRICS
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS seo_impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seo_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seo_ctr DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS branded_traffic INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS non_branded_traffic INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS keywords_improved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS keywords_declined INTEGER DEFAULT 0;

-- =====================================================
-- GOOGLE ADS ADVANCED METRICS
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS ads_impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_ctr DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_avg_cpc DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_impression_share DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_search_lost_budget DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_quality_score DECIMAL(3,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_conversion_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_top_impression_rate DECIMAL(5,2) DEFAULT 0;

-- =====================================================
-- GBP PERFORMANCE METRICS
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS gbp_website_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_directions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_profile_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_searches_direct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_searches_discovery INTEGER DEFAULT 0;

-- =====================================================
-- GBP REVIEWS & ENGAGEMENT (Local SEO Team)
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS gbp_reviews_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_reviews_new INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_rating_avg DECIMAL(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_q_and_a_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_since_review INTEGER DEFAULT 0;

-- =====================================================
-- GBP CONTENT (Content Writer)
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS gbp_photos_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_posts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_posts_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gbp_posts_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_since_post INTEGER DEFAULT 0;

-- =====================================================
-- ACCOUNT MANAGER METRICS
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mom_leads_change DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS alerts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_utilization DECIMAL(5,2) DEFAULT 0;

-- =====================================================
-- CONTENT & ENGAGEMENT METRICS
-- =====================================================
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS top_landing_pages JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS blog_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS returning_users INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0;

-- =====================================================
-- CREATE INDEXES FOR COMMON QUERIES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_metrics_health_score ON client_metrics_summary(health_score);
CREATE INDEX IF NOT EXISTS idx_metrics_alerts ON client_metrics_summary(alerts_count);
CREATE INDEX IF NOT EXISTS idx_metrics_gbp_reviews ON client_metrics_summary(gbp_reviews_new);

-- =====================================================
-- COMMENT ON COLUMNS
-- =====================================================
COMMENT ON COLUMN client_metrics_summary.traffic_ai IS 'Traffic from AI sources (ChatGPT, Perplexity, Claude, etc)';
COMMENT ON COLUMN client_metrics_summary.health_score IS 'Overall client health score 0-100';
COMMENT ON COLUMN client_metrics_summary.mom_leads_change IS 'Month-over-month leads change percentage';
COMMENT ON COLUMN client_metrics_summary.alerts_count IS 'Number of issues needing attention';
COMMENT ON COLUMN client_metrics_summary.top_landing_pages IS 'JSON array of top performing landing pages';
