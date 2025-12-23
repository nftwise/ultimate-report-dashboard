-- Step 1: Add city and owner columns to clients table
-- Run this in Supabase SQL Editor first

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS owner TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;
