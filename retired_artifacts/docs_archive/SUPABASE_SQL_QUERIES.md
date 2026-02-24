# SQL Queries for Supabase

## 1. LIST ALL TABLES AND ROW COUNTS
```sql
SELECT
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schemaname AND table_name = tablename) as row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## 2. GET ALL COLUMNS AND DATA TYPES
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

## 3. CLIENTS TABLE
```sql
SELECT * FROM clients LIMIT 5;
```

## 4. CLIENT_METRICS_SUMMARY - ALL METRICS
```sql
SELECT
  id,
  client_id,
  date,
  -- Ads Metrics
  ad_spend,
  google_ads_conversions,
  ads_impressions,
  ads_clicks,
  ads_ctr,
  ads_avg_cpc,
  ads_phone_calls,
  -- SEO Metrics
  seo_impressions,
  seo_clicks,
  seo_ctr,
  traffic_organic,
  branded_traffic,
  non_branded_traffic,
  keywords_improved,
  keywords_declined,
  -- GBP Metrics
  gbp_calls,
  gbp_website_clicks,
  gbp_directions,
  gbp_profile_views,
  gbp_reviews_count,
  gbp_rating_avg,
  -- GA4 Metrics
  sessions,
  users,
  new_users,
  traffic_paid,
  traffic_direct,
  traffic_referral,
  -- Other
  total_leads,
  cpl,
  form_fills,
  health_score
FROM client_metrics_summary
LIMIT 10;
```

## 5. CLIENT_METRICS_SUMMARY - AGGREGATED BY DATE
```sql
SELECT
  date,
  COUNT(DISTINCT client_id) as num_clients,
  SUM(ad_spend) as total_spend,
  SUM(google_ads_conversions) as total_conversions,
  SUM(seo_impressions) as total_seo_impressions,
  SUM(seo_clicks) as total_seo_clicks,
  SUM(traffic_organic) as total_organic_traffic,
  SUM(gbp_calls) as total_gbp_calls,
  SUM(total_leads) as total_leads,
  SUM(sessions) as total_sessions
FROM client_metrics_summary
WHERE date >= NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

## 6. ADS_CAMPAIGN_METRICS - REAL GOOGLE ADS DATA
```sql
SELECT
  id,
  client_id,
  campaign_id,
  campaign_name,
  date,
  impressions,
  clicks,
  cost,
  conversions,
  conversion_value,
  ctr,
  cpc,
  cpa,
  quality_score,
  impression_share
FROM ads_campaign_metrics
LIMIT 20;
```

## 7. ADS_CAMPAIGN_METRICS - AGGREGATED BY CAMPAIGN
```sql
SELECT
  campaign_id,
  campaign_name,
  COUNT(DISTINCT date) as days,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  SUM(conversion_value) as total_conversion_value,
  ROUND(AVG(ctr), 2) as avg_ctr,
  ROUND(AVG(cpc), 2) as avg_cpc,
  ROUND(AVG(quality_score), 1) as avg_quality_score
FROM ads_campaign_metrics
GROUP BY campaign_id, campaign_name
ORDER BY total_cost DESC;
```

## 8. ADS_AD_GROUP_METRICS - REAL GOOGLE ADS DATA
```sql
SELECT
  id,
  client_id,
  campaign_id,
  ad_group_id,
  ad_group_name,
  date,
  impressions,
  clicks,
  cost,
  conversions,
  ctr,
  cpc,
  cpa
FROM ads_ad_group_metrics
LIMIT 20;
```

## 9. ADS_AD_GROUP_METRICS - AGGREGATED BY AD GROUP
```sql
SELECT
  ad_group_name,
  COUNT(DISTINCT date) as days,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND(AVG(ctr), 2) as avg_ctr,
  ROUND(AVG(cpc), 2) as avg_cpc
FROM ads_ad_group_metrics
GROUP BY ad_group_name
ORDER BY total_cost DESC
LIMIT 20;
```

## 10. CAMPAIGN_SEARCH_TERMS - SEARCH KEYWORDS
```sql
SELECT
  id,
  client_id,
  campaign_id,
  date,
  search_term,
  match_type,
  impressions,
  clicks,
  cost,
  conversions,
  is_irrelevant,
  wasted_spend
FROM campaign_search_terms
LIMIT 30;
```

## 11. CAMPAIGN_SEARCH_TERMS - TOP KEYWORDS BY CLICKS
```sql
SELECT
  search_term,
  COUNT(DISTINCT date) as days,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND(SUM(cost) / NULLIF(SUM(clicks), 0), 2) as cost_per_click,
  ROUND(100.0 * SUM(clicks) / NULLIF(SUM(impressions), 0), 2) as ctr_percent
FROM campaign_search_terms
GROUP BY search_term
ORDER BY total_clicks DESC
LIMIT 30;
```

## 12. CAMPAIGN_SEARCH_TERMS - WASTED SPEND (IRRELEVANT KEYWORDS)
```sql
SELECT
  search_term,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(cost) as wasted_cost,
  SUM(conversions) as conversions
FROM campaign_search_terms
WHERE is_irrelevant = true
GROUP BY search_term
ORDER BY wasted_cost DESC;
```

## 13. CAMPAIGN_CONVERSION_ACTIONS - CONVERSIONS BY TYPE
```sql
SELECT
  id,
  client_id,
  campaign_id,
  date,
  conversion_action_name,
  conversion_action_type,
  conversions,
  conversion_value,
  avg_conversion_lag_days
FROM campaign_conversion_actions
LIMIT 20;
```

## 14. CAMPAIGN_CONVERSION_ACTIONS - AGGREGATED BY ACTION TYPE
```sql
SELECT
  conversion_action_name,
  COUNT(DISTINCT date) as days,
  SUM(conversions) as total_conversions,
  SUM(conversion_value) as total_value,
  ROUND(AVG(conversions), 2) as avg_conversions_per_day,
  ROUND(SUM(conversion_value) / NULLIF(SUM(conversions), 0), 2) as avg_value_per_conversion
FROM campaign_conversion_actions
GROUP BY conversion_action_name
ORDER BY total_conversions DESC;
```

## 15. GOOGLE_ADS_CALL_METRICS - CALL DATA
```sql
SELECT
  id,
  client_id,
  campaign_id,
  date,
  call_duration,
  call_type,
  qualified_lead,
  start_time
FROM google_ads_call_metrics
LIMIT 20;
```

## 16. ADS_INSIGHTS - AI-GENERATED INSIGHTS (DO NOT USE)
```sql
SELECT
  id,
  client_id,
  campaign_id,
  insight_type,
  severity,
  category,
  title,
  description,
  metric_name,
  metric_value,
  impact_estimate,
  confidence_score,
  status
FROM ads_insights
LIMIT 10;
```

## 17. CLIENT-SPECIFIC: GET ALL DATA FOR ONE CLIENT (30 DAYS)
```sql
-- Replace 'YOUR_CLIENT_ID' with actual client ID
SELECT
  date,
  ad_spend,
  google_ads_conversions,
  seo_impressions,
  seo_clicks,
  traffic_organic,
  gbp_calls,
  total_leads,
  cpl,
  sessions
FROM client_metrics_summary
WHERE client_id = 'YOUR_CLIENT_ID'
  AND date >= NOW() - INTERVAL '30 days'
ORDER BY date DESC;
```

## 18. DATE RANGE AVAILABLE IN EACH TABLE
```sql
SELECT
  'client_metrics_summary' as table_name,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as total_rows
FROM client_metrics_summary
UNION ALL
SELECT
  'ads_campaign_metrics',
  MIN(date),
  MAX(date),
  COUNT(*)
FROM ads_campaign_metrics
UNION ALL
SELECT
  'ads_ad_group_metrics',
  MIN(date),
  MAX(date),
  COUNT(*)
FROM ads_ad_group_metrics
UNION ALL
SELECT
  'campaign_search_terms',
  MIN(date),
  MAX(date),
  COUNT(*)
FROM campaign_search_terms
UNION ALL
SELECT
  'campaign_conversion_actions',
  MIN(date),
  MAX(date),
  COUNT(*)
FROM campaign_conversion_actions
ORDER BY table_name;
```

## 19. SPENDING SUMMARY (LAST 30 DAYS)
```sql
SELECT
  COUNT(DISTINCT client_id) as num_clients,
  SUM(ad_spend) as total_ad_spend,
  AVG(ad_spend) as avg_spend_per_client,
  MAX(ad_spend) as max_spend,
  SUM(google_ads_conversions) as total_conversions,
  ROUND(SUM(ad_spend) / NULLIF(SUM(google_ads_conversions), 0), 2) as cost_per_conversion
FROM client_metrics_summary
WHERE date >= NOW() - INTERVAL '30 days';
```

## 20. SEO PERFORMANCE SUMMARY (LAST 30 DAYS)
```sql
SELECT
  COUNT(DISTINCT client_id) as num_clients,
  SUM(seo_impressions) as total_impressions,
  SUM(seo_clicks) as total_clicks,
  ROUND(100.0 * SUM(seo_clicks) / NULLIF(SUM(seo_impressions), 0), 2) as overall_ctr,
  SUM(traffic_organic) as total_organic_traffic,
  SUM(keywords_improved) as total_keywords_improved,
  SUM(keywords_declined) as total_keywords_declined
FROM client_metrics_summary
WHERE date >= NOW() - INTERVAL '30 days';
```

---

## HOW TO RUN THESE QUERIES

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy any query from above
3. Paste and click **Run**

## IMPORTANT NOTES

✅ **USE THESE TABLES** (Real Google Ads API Data):
- `ads_campaign_metrics`
- `ads_ad_group_metrics`
- `campaign_search_terms`
- `campaign_conversion_actions`
- `client_metrics_summary` (most fields)

❌ **DO NOT USE** (AI-generated):
- `ads_insights` (has confidence_score, impact_estimate)
- `ads_correlation_patterns`
