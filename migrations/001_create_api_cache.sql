-- ============================================
-- API Cache Table
-- Purpose: Cache API responses to improve performance
-- Created: 2025-11-12
-- ============================================

-- Create api_cache table
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache identification
  cache_key VARCHAR(255) UNIQUE NOT NULL,

  -- Cached data (JSONB for flexibility)
  data JSONB NOT NULL,

  -- Cache metadata
  source VARCHAR(50), -- 'google_ads', 'google_analytics', 'gbp', 'search_console', 'callrail'
  client_id UUID, -- Optional: link to clients table for easier cleanup

  -- TTL management
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  ttl_seconds INTEGER, -- Store TTL for reference

  -- Usage tracking
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_cache_source ON api_cache(source);
CREATE INDEX IF NOT EXISTS idx_api_cache_client ON api_cache(client_id) WHERE client_id IS NOT NULL;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_cache_cleanup ON api_cache(expires_at) WHERE expires_at < NOW();

-- Comments for documentation
COMMENT ON TABLE api_cache IS 'Caches API responses to reduce external API calls and improve performance';
COMMENT ON COLUMN api_cache.cache_key IS 'Unique identifier for cached data (e.g., "gbp-clientId-2025-01-01-2025-01-31")';
COMMENT ON COLUMN api_cache.data IS 'The actual cached response data in JSON format';
COMMENT ON COLUMN api_cache.expires_at IS 'Timestamp when this cache entry expires and should be refreshed';
COMMENT ON COLUMN api_cache.hit_count IS 'Number of times this cache entry has been accessed';

-- Function to automatically clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % expired cache entries', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_cache IS 'Deletes all expired cache entries and returns count of deleted rows';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON api_cache TO authenticated;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_cache TO authenticated;
