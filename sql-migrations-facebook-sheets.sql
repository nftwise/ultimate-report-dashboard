-- ============================================================================
-- Facebook Section + Google Sheets Integration
-- Add fb_sheet_id column to service_configs
-- ============================================================================

ALTER TABLE service_configs
ADD COLUMN fb_sheet_id TEXT;

-- ============================================================================
-- This migration adds the fb_sheet_id column to store each client's
-- Google Sheet ID for auto-syncing leads.
-- ============================================================================
