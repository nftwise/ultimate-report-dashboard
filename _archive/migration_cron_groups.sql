-- ================================================================
-- Migration: Cron Group Split + GBP fetch_status
-- Run this on Supabase SQL Editor BEFORE deploying code
-- ================================================================

-- 1. Add sync_group to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sync_group TEXT DEFAULT 'A';

-- 2. Assign clients to groups (based on geography)
-- Group A: CA South + Orange County (7 clients) → 2 AM PDT
UPDATE clients SET sync_group = 'A' WHERE id IN (
  'c73fbf15-865f-43f0-9b57-ea7301d537e7',  -- Chiropractic Health Club
  '3c80f930-5f4d-49d6-9428-f2440e496aac',  -- CorePosture
  '7fe8d45e-9171-4994-a9b7-2957d71ab750',  -- Newport Center Family Chiropractic
  'e7deca15-e89a-4a11-97ec-75a9a9119eb4',  -- Ray Chiropractic
  '1da296c9-3de3-42bb-b5a6-e64561b94d16',  -- Restoration Dental
  'db3cee44-9c04-48d8-acd6-b92c01acc984',  -- Whole Body Wellness
  '0459d9d5-f4c6-444e-8f66-2c9f225deeb6'   -- Zen Care Physical Medicine
);

-- Group B: CA North + Mountain + Central (8 clients) → 3 AM PDT
UPDATE clients SET sync_group = 'B' WHERE id IN (
  'be78b194-8157-4b9d-927a-b91477f56afa',  -- Abundant Life Clinic
  'e939d2f3-d052-4f95-8f3e-e3408a98a054',  -- Case Animal Hospital
  '5cfa675b-13a4-4661-a744-e1158c76b376',  -- Chiropractic Care Centre
  '1358cdb0-63d3-47b4-bc74-decd60a2e25b',  -- Chiropractic First
  '899d2381-397a-44fd-a5ed-99c2369eef2a',  -- Hood Chiropractic
  'c83bbae9-5ee0-4924-8a2f-593aec45bd64',  -- North Alabama Spine & Rehab
  'be9bfb4b-419c-40ca-bf29-39157875d471',  -- Tails Animal Chiropractic Care
  'f2a93727-645f-48dd-81d6-543e60353fff'   -- Tinker Family Chiro
);

-- Group C: East Coast + Europe (7 clients) → 4 AM PDT
UPDATE clients SET sync_group = 'C' WHERE id IN (
  '470f1e4d-2287-447d-a146-40c439c68c20',  -- ChiroSolutions Center
  '939903b3-bbcf-4768-938f-1b17395eec95',  -- Cinque Chiropractic
  'c1b7ff3f-2e7c-414f-8de8-469d952dcaa6',  -- DeCarlo Chiropractic
  '7ae04119-3f32-4d75-b5ac-b3938271793a',  -- Haven Chiropractic
  '900a419a-2f88-4bae-8fd7-5d5dea4ddc7e',  -- Healing Hands of Manahawkin
  'e38d5610-eb2c-4dad-a3eb-40219eccb126',  -- Rigel & Rigel
  '721e3508-6e54-4295-8e24-426c4f8cef2a'   -- Southport Chiropractic
);

-- 3. Add fetch_status to gbp_location_daily_metrics
ALTER TABLE gbp_location_daily_metrics
  ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS fetch_error  TEXT;

-- Verify
SELECT sync_group, COUNT(*) as clients FROM clients WHERE is_active = true GROUP BY sync_group ORDER BY sync_group;
