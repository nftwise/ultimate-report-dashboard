-- ============================================
-- GET ALL GA4 AND GSC RELATED TABLES & FIELDS
-- ============================================

SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM
  information_schema.tables t
  LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE
  t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (
    t.table_name ILIKE '%ga%'
    OR t.table_name ILIKE '%gsc%'
    OR t.table_name ILIKE '%google_analytics%'
    OR t.table_name ILIKE '%search_console%'
    OR t.table_name ILIKE '%keywords%'
    OR t.table_name ILIKE '%queries%'
  )
ORDER BY
  t.table_name,
  c.ordinal_position;
