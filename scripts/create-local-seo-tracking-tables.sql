-- ============================================
-- LOCAL SEO TRACKING SYSTEM
-- For managing 30+ clients' local SEO progress
-- ============================================

-- Table 1: Local SEO Metrics (Baseline & Progress)
CREATE TABLE IF NOT EXISTS local_seo_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Review Metrics
  google_reviews_count INTEGER DEFAULT 0,
  yelp_reviews_count INTEGER DEFAULT 0,
  facebook_reviews_count INTEGER DEFAULT 0,
  total_reviews_count INTEGER GENERATED ALWAYS AS (
    google_reviews_count + yelp_reviews_count + facebook_reviews_count
  ) STORED,
  average_rating DECIMAL(2,1),

  -- Citation Metrics
  total_citations_built INTEGER DEFAULT 0,
  target_citations INTEGER DEFAULT 80,
  citations_completion_pct INTEGER GENERATED ALWAYS AS (
    CASE WHEN target_citations > 0
    THEN (total_citations_built * 100 / target_citations)
    ELSE 0 END
  ) STORED,

  -- Rankings
  local_pack_keywords_ranking INTEGER DEFAULT 0,
  target_local_pack_keywords INTEGER DEFAULT 10,
  average_local_pack_position DECIMAL(3,1),

  -- Content Metrics
  blog_posts_created INTEGER DEFAULT 0,
  google_posts_created INTEGER DEFAULT 0,

  -- Monthly Targets
  monthly_review_target INTEGER DEFAULT 30,
  monthly_content_target INTEGER DEFAULT 4,

  -- Metadata
  baseline_date DATE DEFAULT CURRENT_DATE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id)
);

-- Table 2: Weekly Tasks & Progress
CREATE TABLE IF NOT EXISTS local_seo_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Task Details
  task_title TEXT NOT NULL,
  task_description TEXT,
  task_category TEXT CHECK (task_category IN (
    'citations', 'reviews', 'content', 'gbp', 'technical', 'links', 'other'
  )),
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',

  -- Status
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')) DEFAULT 'pending',

  -- Dates
  due_date DATE,
  completed_date DATE,

  -- Notes
  notes TEXT,
  blocked_reason TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 3: Citation Directory Tracking
CREATE TABLE IF NOT EXISTS local_seo_citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Directory Info
  directory_name TEXT NOT NULL,
  directory_url TEXT,
  directory_priority TEXT CHECK (directory_priority IN ('tier1', 'tier2', 'tier3')) DEFAULT 'tier2',

  -- Status
  status TEXT CHECK (status IN ('not_submitted', 'submitted', 'live', 'claimed', 'needs_update')) DEFAULT 'not_submitted',

  -- NAP Consistency
  name_correct BOOLEAN DEFAULT true,
  address_correct BOOLEAN DEFAULT true,
  phone_correct BOOLEAN DEFAULT true,

  -- Dates
  submission_date DATE,
  live_date DATE,
  last_checked DATE,

  -- Links
  listing_url TEXT,

  -- Notes
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, directory_name)
);

-- Table 4: Review Generation Tracking
CREATE TABLE IF NOT EXISTS local_seo_reviews_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Review Details
  platform TEXT CHECK (platform IN ('google', 'yelp', 'facebook', 'healthgrades', 'other')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_date DATE DEFAULT CURRENT_DATE,

  -- Source Tracking
  source TEXT CHECK (source IN ('email', 'sms', 'qr_code', 'in_person', 'organic', 'other')),

  -- Response
  responded BOOLEAN DEFAULT false,
  response_date DATE,

  -- Notes
  review_snippet TEXT,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 5: Content Calendar
CREATE TABLE IF NOT EXISTS local_seo_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Content Details
  content_type TEXT CHECK (content_type IN ('blog', 'google_post', 'social', 'video', 'other')),
  title TEXT NOT NULL,
  target_keyword TEXT,

  -- Status
  status TEXT CHECK (status IN ('planned', 'in_progress', 'ready', 'published')) DEFAULT 'planned',

  -- Dates
  planned_date DATE,
  published_date DATE,

  -- URLs
  content_url TEXT,

  -- Performance
  page_views INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,

  -- Notes
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 6: Monthly Reports Summary
CREATE TABLE IF NOT EXISTS local_seo_monthly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(slug) ON DELETE CASCADE,

  -- Report Period
  report_month DATE NOT NULL,

  -- Metrics Summary
  new_reviews INTEGER DEFAULT 0,
  new_citations INTEGER DEFAULT 0,
  new_content INTEGER DEFAULT 0,

  -- Rankings Movement
  keywords_improved INTEGER DEFAULT 0,
  keywords_declined INTEGER DEFAULT 0,

  -- GBP Metrics
  gbp_views INTEGER DEFAULT 0,
  gbp_calls INTEGER DEFAULT 0,
  gbp_direction_requests INTEGER DEFAULT 0,

  -- Progress vs Goals
  overall_progress_pct INTEGER,

  -- Status
  report_status TEXT CHECK (report_status IN ('draft', 'sent', 'reviewed')) DEFAULT 'draft',
  sent_date DATE,

  -- Notes
  wins TEXT,
  challenges TEXT,
  next_month_priorities TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, report_month)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_local_seo_metrics_client ON local_seo_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_tasks_client ON local_seo_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_tasks_status ON local_seo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_local_seo_tasks_due_date ON local_seo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_local_seo_citations_client ON local_seo_citations(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_citations_status ON local_seo_citations(status);
CREATE INDEX IF NOT EXISTS idx_local_seo_reviews_client ON local_seo_reviews_log(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_reviews_date ON local_seo_reviews_log(review_date);
CREATE INDEX IF NOT EXISTS idx_local_seo_content_client ON local_seo_content(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_content_status ON local_seo_content(status);
CREATE INDEX IF NOT EXISTS idx_local_seo_reports_client ON local_seo_monthly_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_local_seo_reports_month ON local_seo_monthly_reports(report_month);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE local_seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_seo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_seo_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_seo_reviews_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_seo_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_seo_monthly_reports ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to local_seo_metrics"
ON local_seo_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to local_seo_tasks"
ON local_seo_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to local_seo_citations"
ON local_seo_citations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to local_seo_reviews_log"
ON local_seo_reviews_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to local_seo_content"
ON local_seo_content FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to local_seo_monthly_reports"
ON local_seo_monthly_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- VIEWS for Easy Querying
-- ============================================

-- View: Client Overview Dashboard
CREATE OR REPLACE VIEW local_seo_client_overview AS
SELECT
  c.slug as client_id,
  c.name as client_name,
  c.city,

  -- Metrics
  m.total_reviews_count,
  m.average_rating,
  m.total_citations_built,
  m.citations_completion_pct,
  m.local_pack_keywords_ranking,
  m.blog_posts_created,

  -- Tasks Summary
  (SELECT COUNT(*) FROM local_seo_tasks t
   WHERE t.client_id = c.slug AND t.status = 'pending') as pending_tasks,
  (SELECT COUNT(*) FROM local_seo_tasks t
   WHERE t.client_id = c.slug AND t.status = 'in_progress') as active_tasks,
  (SELECT COUNT(*) FROM local_seo_tasks t
   WHERE t.client_id = c.slug AND t.status = 'blocked') as blocked_tasks,

  -- Recent Activity
  (SELECT COUNT(*) FROM local_seo_reviews_log r
   WHERE r.client_id = c.slug AND r.review_date >= CURRENT_DATE - INTERVAL '30 days') as reviews_last_30_days,

  m.last_updated
FROM clients c
LEFT JOIN local_seo_metrics m ON c.slug = m.client_id
ORDER BY m.last_updated DESC;

-- View: This Week's Priority Tasks
CREATE OR REPLACE VIEW local_seo_this_week_tasks AS
SELECT
  t.*,
  c.name as client_name,
  c.city
FROM local_seo_tasks t
JOIN clients c ON t.client_id = c.slug
WHERE t.status IN ('pending', 'in_progress')
  AND (t.due_date <= CURRENT_DATE + INTERVAL '7 days' OR t.priority = 'high')
ORDER BY
  CASE t.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  t.due_date;

-- ============================================
-- SAMPLE DATA INSERTION (CorePosture)
-- ============================================

-- Insert baseline metrics for CorePosture
INSERT INTO local_seo_metrics (
  client_id,
  yelp_reviews_count,
  google_reviews_count,
  average_rating,
  total_citations_built,
  target_citations,
  local_pack_keywords_ranking,
  target_local_pack_keywords,
  average_local_pack_position,
  monthly_review_target,
  baseline_date
) VALUES (
  'coreposture',
  159,
  0,  -- Need to verify actual Google count
  4.8,
  30,
  80,
  0,
  10,
  4.0,
  30,
  CURRENT_DATE
) ON CONFLICT (client_id) DO NOTHING;

-- Insert Week 1 tasks for CorePosture
INSERT INTO local_seo_tasks (client_id, task_title, task_category, priority, due_date) VALUES
('coreposture', 'Add Google Maps embed to Contact page', 'technical', 'high', CURRENT_DATE + INTERVAL '2 days'),
('coreposture', 'Submit to Healthgrades', 'citations', 'high', CURRENT_DATE + INTERVAL '3 days'),
('coreposture', 'Submit to Vitals', 'citations', 'high', CURRENT_DATE + INTERVAL '3 days'),
('coreposture', 'Submit to ZocDoc', 'citations', 'high', CURRENT_DATE + INTERVAL '3 days'),
('coreposture', 'Create review request QR code', 'reviews', 'high', CURRENT_DATE + INTERVAL '5 days'),
('coreposture', 'Setup email automation for reviews', 'reviews', 'high', CURRENT_DATE + INTERVAL '7 days'),
('coreposture', 'Optimize GBP description', 'gbp', 'medium', CURRENT_DATE + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Insert top priority citations to track
INSERT INTO local_seo_citations (client_id, directory_name, directory_priority, status) VALUES
('coreposture', 'Google Business Profile', 'tier1', 'claimed'),
('coreposture', 'Yelp', 'tier1', 'live'),
('coreposture', 'Healthgrades', 'tier1', 'not_submitted'),
('coreposture', 'Vitals', 'tier1', 'not_submitted'),
('coreposture', 'ZocDoc', 'tier1', 'not_submitted'),
('coreposture', 'WebMD Physician Directory', 'tier1', 'not_submitted'),
('coreposture', 'Better Business Bureau', 'tier1', 'claimed'),
('coreposture', 'RateMDs', 'tier2', 'not_submitted'),
('coreposture', 'Wellness.com', 'tier2', 'not_submitted'),
('coreposture', 'FindaTopDoc', 'tier2', 'not_submitted')
ON CONFLICT (client_id, directory_name) DO NOTHING;

-- Insert content calendar
INSERT INTO local_seo_content (client_id, content_type, title, target_keyword, status, planned_date) VALUES
('coreposture', 'blog', 'Best Chiropractors in Newport Beach 2025', 'best chiropractor newport beach', 'planned', CURRENT_DATE + INTERVAL '14 days'),
('coreposture', 'blog', 'Sports Injury Chiropractor Newport Beach Guide', 'sports chiropractor newport beach', 'planned', CURRENT_DATE + INTERVAL '21 days'),
('coreposture', 'blog', 'Auto Accident Chiropractic Care: Newport Beach Insurance Guide', 'auto accident chiropractor', 'planned', CURRENT_DATE + INTERVAL '28 days'),
('coreposture', 'google_post', 'Avoid $6,000 Surgery Bills', 'chiropractor newport beach', 'ready', CURRENT_DATE + INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- USEFUL QUERIES (For Reference)
-- ============================================

-- Get all clients overview
-- SELECT * FROM local_seo_client_overview;

-- Get this week's priority tasks
-- SELECT * FROM local_seo_this_week_tasks;

-- Get citation progress for a client
-- SELECT
--   directory_name,
--   status,
--   directory_priority,
--   name_correct AND address_correct AND phone_correct as nap_consistent
-- FROM local_seo_citations
-- WHERE client_id = 'coreposture'
-- ORDER BY
--   CASE directory_priority WHEN 'tier1' THEN 1 WHEN 'tier2' THEN 2 ELSE 3 END,
--   directory_name;

-- Get monthly review trend
-- SELECT
--   DATE_TRUNC('month', review_date) as month,
--   COUNT(*) as reviews_count,
--   AVG(rating) as avg_rating
-- FROM local_seo_reviews_log
-- WHERE client_id = 'coreposture'
-- GROUP BY month
-- ORDER BY month DESC;
