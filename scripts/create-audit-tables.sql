-- ============================================
-- CLIENT AUDIT SYSTEM - DATABASE SCHEMA
-- ============================================
-- Created: October 29, 2025
-- Purpose: Track Local SEO audits, action items, and metrics for all clients
--
-- Tables:
--   1. client_audits - Main audit records
--   2. audit_action_items - Tasks/recommendations from audits
--   3. audit_metrics - Historical metric tracking
-- ============================================

-- ============================================
-- TABLE 1: client_audits
-- Stores comprehensive audit records for each client
-- ============================================
CREATE TABLE IF NOT EXISTS client_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Audit metadata
  audit_type VARCHAR(50) NOT NULL DEFAULT 'local_seo', -- local_seo, technical_seo, content_audit
  audit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  auditor_name VARCHAR(100), -- Who performed the audit
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- completed, in_progress, scheduled

  -- Overall scores (0-100)
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Category scores (JSON for flexibility)
  category_scores JSONB,
  -- Example: {
  --   "google_business_profile": 16,
  --   "online_reviews": 15,
  --   "technical_seo": 19,
  --   "citations": 18,
  --   "local_visibility": 14
  -- }

  -- Key metrics at time of audit (JSON for flexibility)
  metrics JSONB,
  -- Example: {
  --   "google_reviews": 115,
  --   "review_rating": 4.8,
  --   "yelp_reviews": 159,
  --   "citations_count": 8,
  --   "local_ranking": 3,
  --   "gbp_views": 1250,
  --   "website_traffic": 3500
  -- }

  -- Competitive analysis (JSON)
  competitors JSONB,
  -- Example: [
  --   {"name": "Competitor A", "rating": 4.9, "reviews": 118, "ranking": 1},
  --   {"name": "Competitor B", "rating": 4.9, "reviews": 117, "ranking": 2}
  -- ]

  -- Detailed findings (Markdown or HTML)
  findings TEXT,

  -- Executive summary
  summary TEXT,

  -- Next audit scheduled date
  next_audit_date DATE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexing for performance
  CONSTRAINT unique_client_audit_date UNIQUE(client_id, audit_date)
);

-- Indexes for fast queries
CREATE INDEX idx_client_audits_client_id ON client_audits(client_id);
CREATE INDEX idx_client_audits_audit_date ON client_audits(audit_date DESC);
CREATE INDEX idx_client_audits_status ON client_audits(status);
CREATE INDEX idx_client_audits_audit_type ON client_audits(audit_type);

-- ============================================
-- TABLE 2: audit_action_items
-- Stores actionable tasks from each audit
-- ============================================
CREATE TABLE IF NOT EXISTS audit_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES client_audits(id) ON DELETE CASCADE,

  -- Task details
  title VARCHAR(255) NOT NULL, -- Short description
  description TEXT, -- Detailed explanation
  category VARCHAR(50), -- review_generation, gbp_optimization, citations, content, technical

  -- Priority & Status
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- high, medium, low
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  -- Timeline
  deadline DATE,
  completed_date DATE,
  estimated_hours DECIMAL(5,2), -- Time estimate

  -- Impact
  impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10), -- 1-10 scale
  expected_outcome TEXT, -- What success looks like

  -- Assignment
  assigned_to VARCHAR(100), -- Person/team responsible

  -- Progress tracking
  notes TEXT, -- Implementation notes
  resources_needed TEXT, -- Tools, budget, etc.

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_action_items_client_id ON audit_action_items(client_id);
CREATE INDEX idx_action_items_audit_id ON audit_action_items(audit_id);
CREATE INDEX idx_action_items_status ON audit_action_items(status);
CREATE INDEX idx_action_items_priority ON audit_action_items(priority);
CREATE INDEX idx_action_items_deadline ON audit_action_items(deadline);

-- ============================================
-- TABLE 3: audit_metrics
-- Historical metrics tracking (monthly snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Time period
  metric_date DATE NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, quarterly

  -- Review metrics
  google_reviews INTEGER,
  google_rating DECIMAL(2,1) CHECK (google_rating >= 0 AND google_rating <= 5),
  yelp_reviews INTEGER,
  yelp_rating DECIMAL(2,1) CHECK (yelp_rating >= 0 AND yelp_rating <= 5),
  total_reviews INTEGER,
  avg_rating DECIMAL(2,1),
  new_reviews_count INTEGER, -- New reviews this period
  review_response_rate DECIMAL(5,2), -- Percentage

  -- Citation metrics
  citations_count INTEGER,
  nap_consistency_score INTEGER CHECK (nap_consistency_score >= 0 AND nap_consistency_score <= 100),

  -- Ranking metrics
  local_pack_ranking INTEGER, -- Position in local 3-pack
  organic_ranking INTEGER, -- Average organic position for key terms

  -- Google Business Profile metrics
  gbp_search_views INTEGER,
  gbp_maps_views INTEGER,
  gbp_total_actions INTEGER,
  gbp_website_clicks INTEGER,
  gbp_phone_calls INTEGER,
  gbp_direction_requests INTEGER,

  -- Website metrics
  organic_traffic INTEGER,
  local_traffic INTEGER,
  conversion_rate DECIMAL(5,2),
  conversions INTEGER,

  -- Additional metrics (flexible JSON)
  custom_metrics JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one record per client per date
  CONSTRAINT unique_client_metric_date UNIQUE(client_id, metric_date, period)
);

-- Indexes for fast time-series queries
CREATE INDEX idx_metrics_client_id ON audit_metrics(client_id);
CREATE INDEX idx_metrics_date ON audit_metrics(metric_date DESC);
CREATE INDEX idx_metrics_client_date ON audit_metrics(client_id, metric_date DESC);

-- ============================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_audits_updated_at BEFORE UPDATE ON client_audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_items_updated_at BEFORE UPDATE ON audit_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON audit_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures clients can only see their own data
-- ============================================

-- Enable RLS
ALTER TABLE client_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for client_audits
CREATE POLICY "Clients can view their own audits" ON client_audits
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM users WHERE auth.uid() = id
    )
  );

CREATE POLICY "Admins can view all audits" ON client_audits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth.uid() = id AND role = 'admin'
    )
  );

-- Policies for audit_action_items
CREATE POLICY "Clients can view their own action items" ON audit_action_items
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM users WHERE auth.uid() = id
    )
  );

CREATE POLICY "Admins can view all action items" ON audit_action_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth.uid() = id AND role = 'admin'
    )
  );

-- Policies for audit_metrics
CREATE POLICY "Clients can view their own metrics" ON audit_metrics
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM users WHERE auth.uid() = id
    )
  );

CREATE POLICY "Admins can view all metrics" ON audit_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth.uid() = id AND role = 'admin'
    )
  );

-- ============================================
-- HELPFUL VIEWS
-- Pre-built queries for common use cases
-- ============================================

-- View: Latest audit for each client
CREATE OR REPLACE VIEW latest_client_audits AS
SELECT DISTINCT ON (client_id)
  ca.*,
  c.name as client_name,
  c.slug as client_slug
FROM client_audits ca
JOIN clients c ON c.id = ca.client_id
ORDER BY client_id, audit_date DESC;

-- View: Pending action items by client
CREATE OR REPLACE VIEW pending_action_items AS
SELECT
  ai.*,
  c.name as client_name,
  c.slug as client_slug,
  ca.audit_date
FROM audit_action_items ai
JOIN clients c ON c.id = ai.client_id
JOIN client_audits ca ON ca.id = ai.audit_id
WHERE ai.status IN ('pending', 'in_progress')
ORDER BY
  CASE ai.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  ai.deadline ASC NULLS LAST;

-- View: Client progress over time
CREATE OR REPLACE VIEW client_audit_progress AS
SELECT
  c.id as client_id,
  c.name as client_name,
  ca.audit_date,
  ca.overall_score,
  ca.category_scores,
  LAG(ca.overall_score) OVER (PARTITION BY c.id ORDER BY ca.audit_date) as previous_score,
  ca.overall_score - LAG(ca.overall_score) OVER (PARTITION BY c.id ORDER BY ca.audit_date) as score_change
FROM clients c
JOIN client_audits ca ON ca.client_id = c.id
ORDER BY c.name, ca.audit_date DESC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Audit system tables created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Created tables:';
  RAISE NOTICE '   - client_audits (audit records)';
  RAISE NOTICE '   - audit_action_items (tasks/recommendations)';
  RAISE NOTICE '   - audit_metrics (historical tracking)';
  RAISE NOTICE '';
  RAISE NOTICE '👁️  Created views:';
  RAISE NOTICE '   - latest_client_audits';
  RAISE NOTICE '   - pending_action_items';
  RAISE NOTICE '   - client_audit_progress';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Row Level Security enabled with client/admin policies';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Ready to track audits for 30+ clients over 5 years!';
END $$;
