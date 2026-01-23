-- ============================================
-- GBP (Google Business Profile) Schema
-- Optimized for: Backfill 1-year + Daily cronjob + 5-10 years retention
-- ============================================

-- 1. GBP LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS gbp_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gbp_location_id text NOT NULL,
  location_name text NOT NULL,
  address text,
  phone text,
  website text,
  business_type text,
  is_active boolean DEFAULT true,
  verified_by_owner boolean DEFAULT false,

  -- Sync tracking
  synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_gbp_location UNIQUE(client_id, gbp_location_id)
);

CREATE INDEX idx_gbp_locations_client ON gbp_locations(client_id);
CREATE INDEX idx_gbp_locations_gbp_id ON gbp_locations(gbp_location_id);

-- ============================================
-- 2. DAILY METRICS TABLE (Main data)
-- ============================================
-- For: Views, Actions (calls, directions, clicks), etc.
-- Strategy: 1 row per location per day
-- Backfill: Insert 365 rows per location
-- Daily cronjob: UPSERT today's data

CREATE TABLE IF NOT EXISTS gbp_location_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),
  date date NOT NULL,

  -- Core metrics (from GBP Insights API)
  views integer DEFAULT 0,                    -- Profile views
  actions integer DEFAULT 0,                  -- Total customer actions
  direction_requests integer DEFAULT 0,       -- Direction requests
  phone_calls integer DEFAULT 0,              -- Phone calls
  website_clicks integer DEFAULT 0,           -- Website clicks

  -- Review/Rating snapshot (daily aggregate)
  total_reviews integer DEFAULT 0,
  new_reviews_today integer DEFAULT 0,
  average_rating numeric(3,2),

  -- Photo stats (daily)
  business_photo_views integer DEFAULT 0,
  customer_photo_count integer DEFAULT 0,
  customer_photo_views integer DEFAULT 0,

  -- Post engagement (cumulative for the day)
  posts_count integer DEFAULT 0,
  posts_views integer DEFAULT 0,
  posts_actions integer DEFAULT 0,

  -- Message stats (if applicable)
  messages_received integer DEFAULT 0,
  messages_conversations integer DEFAULT 0,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_daily_metric UNIQUE(location_id, date)
);

CREATE INDEX idx_daily_metrics_location_date ON gbp_location_daily_metrics(location_id, date DESC);
CREATE INDEX idx_daily_metrics_client_date ON gbp_location_daily_metrics(client_id, date DESC);
CREATE INDEX idx_daily_metrics_date ON gbp_location_daily_metrics(date DESC);

-- Partition hint for faster backfill queries
-- SELECT * FROM gbp_location_daily_metrics WHERE date >= '2024-01-01' AND date < '2025-01-01'

-- ============================================
-- 3. REVIEWS TABLE (Historical data)
-- ============================================
-- Strategy: Each review is a row (can be updated if replied)
-- Backfill: Import all historical reviews
-- Daily cronjob: Fetch new reviews + check for replies

CREATE TABLE IF NOT EXISTS gbp_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),

  -- Review metadata
  review_id text NOT NULL,
  reviewer_name text,
  reviewer_profile_picture_url text,

  -- Review content
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  review_date date NOT NULL,

  -- Reply (if owner replied)
  reply_text text,
  reply_date timestamp with time zone,

  -- Engagement
  helpful_count integer DEFAULT 0,
  unhelpful_count integer DEFAULT 0,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_review UNIQUE(location_id, review_id)
);

CREATE INDEX idx_reviews_location ON gbp_reviews(location_id);
CREATE INDEX idx_reviews_date ON gbp_reviews(review_date DESC);
CREATE INDEX idx_reviews_rating ON gbp_reviews(rating);
CREATE INDEX idx_reviews_client_date ON gbp_reviews(client_id, review_date DESC);

-- ============================================
-- 4. POSTS TABLE (Historical posts data)
-- ============================================
-- Strategy: Each post is a row with aggregated metrics
-- Backfill: Import all historical posts
-- Daily cronjob: Fetch new posts + update view counts

CREATE TABLE IF NOT EXISTS gbp_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),

  -- Post metadata
  post_id text NOT NULL,
  post_type text,                             -- EVENT, OFFER, PRODUCT, ALERT, etc.
  post_title text,
  post_content text,
  post_image_url text,

  -- Dates
  created_date timestamp with time zone,
  expiration_date timestamp with time zone,

  -- Metrics
  views integer DEFAULT 0,
  impressions integer DEFAULT 0,
  actions integer DEFAULT 0,                  -- Clicks, calls, etc.
  website_clicks integer DEFAULT 0,
  phone_calls integer DEFAULT 0,
  direction_requests integer DEFAULT 0,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_post UNIQUE(location_id, post_id)
);

CREATE INDEX idx_posts_location ON gbp_posts(location_id);
CREATE INDEX idx_posts_created_date ON gbp_posts(created_date DESC);
CREATE INDEX idx_posts_client ON gbp_posts(client_id);

-- ============================================
-- 5. PHOTOS TABLE (Business & customer photos)
-- ============================================
-- Strategy: Track photos + metrics over time
-- Backfill: Import all photo metadata
-- Daily cronjob: Fetch new photos + update view counts

CREATE TABLE IF NOT EXISTS gbp_location_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),

  -- Photo metadata
  photo_id text NOT NULL,
  photo_url text,
  photo_type text,                           -- BUSINESS, CUSTOMER, MENU, etc.
  is_customer_photo boolean DEFAULT false,
  uploaded_by text,

  -- Metrics
  views integer DEFAULT 0,
  upload_date timestamp with time zone,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_photo UNIQUE(location_id, photo_id)
);

CREATE INDEX idx_photos_location ON gbp_location_photos(location_id);
CREATE INDEX idx_photos_upload_date ON gbp_location_photos(upload_date DESC);
CREATE INDEX idx_photos_client ON gbp_location_photos(client_id);

-- ============================================
-- 6. Q&A TABLE (Questions & Answers)
-- ============================================
-- Strategy: Track Q&A data per location
-- Backfill: Import historical Q&A
-- Daily cronjob: Fetch new questions + answered count

CREATE TABLE IF NOT EXISTS gbp_qa_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),

  -- Q&A metadata
  question_id text NOT NULL,
  question_text text NOT NULL,
  asker_name text,

  -- Answers
  answer_text text,
  answerer_name text,
  answer_date timestamp with time zone,

  -- Dates
  question_date timestamp with time zone,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT unique_question UNIQUE(location_id, question_id)
);

CREATE INDEX idx_qa_location ON gbp_qa_data(location_id);
CREATE INDEX idx_qa_question_date ON gbp_qa_data(question_date DESC);
CREATE INDEX idx_qa_client ON gbp_qa_data(client_id);

-- ============================================
-- 7. SYNC LOG (For tracking backfill + daily jobs)
-- ============================================
-- Track when data was synced, useful for debugging

CREATE TABLE IF NOT EXISTS gbp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES gbp_locations(id) ON DELETE CASCADE,
  sync_type text NOT NULL,                   -- 'backfill', 'daily', 'manual'
  date_range_start date,
  date_range_end date,
  records_synced integer,
  status text,                                -- 'success', 'partial', 'failed'
  error_message text,

  synced_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_sync_log_location ON gbp_sync_log(location_id);
CREATE INDEX idx_sync_log_synced_at ON gbp_sync_log(synced_at DESC);

-- ============================================
-- HELPFUL COMMENTS FOR BACKFILL & MAINTENANCE
-- ============================================

/*
BACKFILL STRATEGY:
==================

1. Upload GBP Locations:
   INSERT INTO gbp_locations (client_id, gbp_location_id, location_name, address, phone, website)
   VALUES (...)

2. Backfill 1 Year Daily Metrics (2024):
   -- Insert 365 rows per location
   INSERT INTO gbp_location_daily_metrics
   (location_id, client_id, date, views, actions, direction_requests, phone_calls, website_clicks, ...)
   VALUES (...)
   ON CONFLICT (location_id, date) DO UPDATE SET ...

3. Backfill Historical Reviews:
   INSERT INTO gbp_reviews
   (location_id, client_id, review_id, reviewer_name, rating, review_text, review_date)
   VALUES (...)

4. Backfill Historical Posts:
   INSERT INTO gbp_posts
   (location_id, client_id, post_id, post_type, views, actions)
   VALUES (...)

DAILY CRONJOB STRATEGY:
=======================
- Run at 2-3 AM daily
- UPSERT daily_metrics for today (ON CONFLICT UPDATE)
- INSERT new reviews
- INSERT new posts
- UPDATE post/photo view counts
- Log syncs in gbp_sync_log

RETENTION POLICY:
=================
- Daily metrics: Keep indefinitely (5-10 years)
- Reviews: Keep indefinitely
- Posts: Keep indefinitely
- Use date filtering for reports: WHERE date >= '2024-01-01'
*/
