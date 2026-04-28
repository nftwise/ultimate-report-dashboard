-- ============================================
-- GET ALL TABLES, COLUMNS, AND DATA TYPES
-- ============================================

SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_name = t.table_name
   AND constraint_type = 'PRIMARY KEY') as has_primary_key
FROM
  information_schema.tables t
  LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE
  t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY
  t.table_name,
  c.ordinal_position;

-- ============================================
-- GET ROW COUNT FOR EACH TABLE
-- ============================================

SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================
-- GET SPECIFIC TABLE DETAILS (SAMPLE DATA)
-- ============================================

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
