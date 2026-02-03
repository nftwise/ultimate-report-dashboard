# Supabase Database Comprehensive Analysis Report

**Generated:** 2026-02-03
**Database:** tupedninjtaarmdwppgy.supabase.co
**Total Records Analyzed:** 2,000 records across 2 main tables
**Total Clients:** 25

---

## Executive Summary

The Supabase database contains two primary tables for client metrics and GBP (Google Business Profile) analytics:

1. **`client_metrics_summary`** - 1,000 records with comprehensive marketing metrics
2. **`gbp_location_daily_metrics`** - 1,000 records with daily GBP performance data

### Key Findings:

- **Google Ads data is comprehensive**: 47% of ads_impressions have data, 45.8% of ads_clicks have data
- **GBP data is sparse**: Only 1.6% of GBP calls, 1% of GBP directions, and 1.6% of GBP website clicks have non-zero values
- **GBP Location metrics are more populated**: 84.8% of website_clicks, 72.7% of direction_requests, 65.2% of phone_calls have data
- **Date range**: February 10, 2025 to January 19, 2026 (approximately 11 months of data)
- **No additional GBP-related tables found** - Only these two main metric tables exist

---

## 1. CLIENT_METRICS_SUMMARY TABLE

### Overview
- **Total Records:** 1,000
- **Schema Type:** Client-level aggregated daily metrics
- **Primary Keys:** `id` (UUID), `client_id` (UUID)
- **Date Range:** 2025-02-10 to 2026-01-19

### Column Definitions with Data Status

| # | Column Name | Data Type | Sample Value | Data Status | Notes |
|---|---|---|---|---|---|
| 1 | id | string (UUID) | 1a111af4-f651-4615-af42-422a8b0abef1 | Has Value | Unique record identifier |
| 2 | client_id | string (UUID) | 470f1e4d-2287-447d-a146-40c439c68c20 | Has Value | Foreign key to clients table |
| 3 | date | string (ISO 8601) | 2025-10-22 | Has Value | Daily metric date |
| 4 | period_type | string | daily | Has Value | Always "daily" |
| 5 | created_at | string (timestamp) | 2025-12-18T10:32:30.037651+00:00 | Has Value | Record creation timestamp |
| 6 | updated_at | string (timestamp) | 2026-01-21T06:22:54.316+00:00 | Has Value | Last update timestamp |
| 7 | budget_utilization | number | 73 | Has Value | % of budget used |
| 8 | health_score | number | 60 | Has Value | Overall health metric (0-100) |
| 9 | google_rank | NULL | null | Empty | Currently not populated |

**GBP Metrics (Google Business Profile):**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 26 | gbp_calls | number | 1.6% (16/1000) | 2.56 | Phone calls from GBP |
| 27 | gbp_directions | number | 1.0% (10/1000) | 2.70 | Direction requests |
| 39 | gbp_website_clicks | number | 1.6% (16/1000) | 2.25 | Website clicks from GBP |
| 32 | gbp_profile_views | number | 2.3% (23/1000) | 23.17 | Profile page views |
| 31 | gbp_posts_views | number | 0% (0/1000) | N/A | **NO DATA** |
| 37 | gbp_searches_direct | number | 0% (0/1000) | N/A | **NO DATA** |
| 38 | gbp_searches_discovery | number | 0% (0/1000) | N/A | **NO DATA** |
| 28 | gbp_photos_count | number | 0% (0/1000) | N/A | **NO DATA** |
| 33 | gbp_q_and_a_count | number | 0% (0/1000) | N/A | **NO DATA** |
| 34 | gbp_rating_avg | number | 0% (0/1000) | N/A | **NO DATA** |
| 35 | gbp_reviews_count | number | 0% (0/1000) | N/A | **NO DATA** |
| 36 | gbp_reviews_new | number | 0% (0/1000) | N/A | **NO DATA** |

**Google Ads Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 40 | google_ads_conversions | number | 27.9% (279/1000) | 2.47 | Total conversions |
| 7 | ads_impressions | number | 47.0% (470/1000) | 211.36 | Ad impressions |
| 3 | ads_clicks | number | 45.8% (458/1000) | 11.33 | Ad clicks |
| 2 | ads_avg_cpc | number | 0% (0/1000) | N/A | Average cost per click |
| 5 | ads_ctr | number | 0% (0/1000) | N/A | Click-through rate |
| 1 | ad_spend | number | 45.8% (458/1000) | 67.39 | Total ad spend |
| 4 | ads_conversion_rate | number | 0% (0/1000) | N/A | Conversion rate |
| 6 | ads_impression_share | number | 0% (0/1000) | N/A | Impression share |
| 8 | ads_phone_calls | number | 0% (0/1000) | N/A | Calls from ads |
| 9 | ads_quality_score | number | 0% (0/1000) | N/A | Quality score |
| 10 | ads_search_lost_budget | number | 0% (0/1000) | N/A | Lost budget |
| 11 | ads_top_impression_rate | number | 0% (0/1000) | N/A | Top impression rate |

**SEO Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 53 | seo_impressions | number | 15.7% (157/1000) | 2,069.10 | Search impressions |
| 51 | seo_clicks | number | 15.2% (152/1000) | 13.95 | Organic search clicks |
| 52 | seo_ctr | number | 0% (0/1000) | N/A | Organic CTR |

**Traffic & Engagement Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 54 | sessions | number | 15.7% (157/1000) | 72.49 | Website sessions |
| 55 | sessions_desktop | number | 0% (0/1000) | N/A | Desktop sessions |
| 56 | sessions_mobile | number | 0% (0/1000) | N/A | Mobile sessions |
| 47 | new_users | number | 0% (0/1000) | N/A | New user count |
| 50 | returning_users | number | 0% (0/1000) | N/A | Returning users |
| 66 | users | number | 0% (0/1000) | N/A | Total users |
| 17 | content_conversions | number | 0% (0/1000) | N/A | Content-driven conversions |
| 25 | form_fills | number | 0% (0/1000) | N/A | Form submissions |
| 12 | alerts_count | number | 0% (0/1000) | N/A | System alerts |

**Traffic Source Breakdown:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 61 | traffic_direct | number | 0% (0/1000) | N/A | Direct traffic |
| 62 | traffic_organic | number | 0% (0/1000) | N/A | Organic traffic |
| 63 | traffic_paid | number | 0% (0/1000) | N/A | Paid traffic |
| 64 | traffic_referral | number | 0% (0/1000) | N/A | Referral traffic |
| 60 | traffic_ai | number | 0% (0/1000) | N/A | AI-driven traffic |

**Lead & Performance Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 46 | total_leads | number | 0% (0/1000) | N/A | Total qualified leads |
| 48 | mom_leads_change | number | 0% (0/1000) | N/A | Month-over-month change |
| 18 | conversion_rate | number | 0% (0/1000) | N/A | Overall conversion rate |
| 19 | cpl | number | 0% (0/1000) | N/A | Cost per lead |

**Content Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 57 | top_keywords | number | 0% (0/1000) | N/A | Top keyword count |
| 58 | top_landing_pages | ARRAY | Empty | 0 | Top landing pages array (empty) |
| 13 | blog_sessions | number | 0% (0/1000) | N/A | Blog page sessions |
| 14 | branded_traffic | number | 0% (0/1000) | N/A | Branded search traffic |
| 15 | non_branded_traffic | number | 0% (0/1000) | N/A | Non-branded traffic |
| 24 | engagement_rate | number | 0% (0/1000) | N/A | Engagement rate |

**Review & Post Metrics:**

| # | Column Name | Data Type | Non-Zero % | Avg Value | Notes |
|---|---|---|---|---|---|
| 22 | days_since_post | number | 0% (0/1000) | N/A | Days since last post |
| 23 | days_since_review | number | 0% (0/1000) | N/A | Days since last review |

### Data Quality Assessment

**Strong Data Areas:**
- ✅ Google Ads metrics (impressions, clicks, spend)
- ✅ Basic GBP location data (profile_views)
- ✅ Health scores and budget utilization
- ✅ SEO impressions and clicks

**Weak/Missing Data Areas:**
- ❌ GBP calls, directions, website clicks (1-2% populated)
- ❌ All traffic source breakdowns (0% data)
- ❌ Session type breakdown (0% data)
- ❌ All derived metrics (CTR, conversion rate, CPA, etc.)
- ❌ Google rank metric (completely empty)
- ❌ Post engagement metrics (0% data)

---

## 2. GBP_LOCATION_DAILY_METRICS TABLE

### Overview
- **Total Records:** 1,000
- **Schema Type:** Daily GBP location-level metrics
- **Primary Keys:** `id` (UUID), `location_id` (UUID)
- **Foreign Keys:** `client_id` (UUID)
- **Date Range:** 2025-01-01 to 2026-01-19

### Column Definitions with Data Status

| # | Column Name | Data Type | Sample Value | Data Status | Notes |
|---|---|---|---|---|---|
| 1 | id | string (UUID) | 03e5a901-515e-4c4e-a054-0992b9fc357e | Has Value | Unique record identifier |
| 2 | client_id | string (UUID) | c1b7ff3f-2e7c-414f-8de8-469d952dcaa6 | Has Value | Foreign key to clients table |
| 3 | location_id | string (UUID) | daac098e-f00e-435b-86c0-a15a6e31a4a6 | Has Value | Location identifier |
| 4 | date | string (ISO 8601) | 2025-01-15 | Has Value | Daily metric date |
| 5 | created_at | string (timestamp) | 2026-01-23T14:57:59.3958+00:00 | Has Value | Record creation timestamp |
| 6 | updated_at | string (timestamp) | 2026-01-23T14:57:59.3958+00:00 | Has Value | Last update timestamp |

### Metrics Columns - Detailed Analysis

| # | Column Name | Data Type | Non-Zero % | Avg Value (non-zero) | Status | Notes |
|---|---|---|---|---|---|---|
| 7 | views | number | 0.5% (5/1000) | 102.00 | Sparse | Profile page views (mostly zeros) |
| 8 | actions | number | 0.5% (5/1000) | 22.60 | Sparse | User actions on profile |
| 9 | phone_calls | number | 65.2% (652/1000) | 4.38 | **STRONG** | Direct phone calls |
| 10 | direction_requests | number | 72.7% (727/1000) | 5.86 | **STRONG** | Direction requests to location |
| 11 | website_clicks | number | 84.8% (848/1000) | 3.35 | **STRONG** | Website clicks from GBP |
| 12 | total_reviews | number | 0.5% (5/1000) | 18.40 | Sparse | Total accumulated reviews |
| 13 | new_reviews_today | number | 0% (0/1000) | N/A | **NO DATA** | New reviews per day |
| 14 | average_rating | number | 0.5% (5/1000) | 4.42 | Sparse | Average rating score |
| 15 | posts_views | number | 0% (0/1000) | N/A | **NO DATA** | GBP post views |
| 16 | posts_actions | number | 0% (0/1000) | N/A | **NO DATA** | Actions on posts |
| 17 | posts_count | number | 0% (0/1000) | N/A | **NO DATA** | Number of posts |
| 18 | business_photo_views | number | 0% (0/1000) | N/A | **NO DATA** | Business photo views |
| 19 | customer_photo_count | number | 0% (0/1000) | N/A | **NO DATA** | Customer-uploaded photos |
| 20 | customer_photo_views | number | 0% (0/1000) | N/A | **NO DATA** | Customer photo views |

### Data Quality Assessment

**Strong Data Areas:**
- ✅ Website clicks (84.8% populated, avg 3.35 clicks/day)
- ✅ Direction requests (72.7% populated, avg 5.86/day)
- ✅ Phone calls (65.2% populated, avg 4.38/day)

**Weak/Missing Data Areas:**
- ⚠️ Views and actions (0.5% - mostly dummy/zero data)
- ⚠️ Total reviews and ratings (0.5% - sparse data)
- ❌ Post metrics (0% - completely empty)
- ❌ Photo metrics (0% - completely empty)
- ❌ New reviews per day (0% - completely empty)

### Key Insights

**What Data IS Reliable:**
- Phone calls, direction requests, and website clicks represent genuine user interactions
- These metrics appear to come from actual GBP API data

**What Data IS NOT Reliable:**
- Most other metrics are either all zeros or have single-digit populated records
- Suggests data collection may have started later for these metrics
- Photo and post metrics may not be implemented in current data pipeline

---

## 3. Additional GBP-Related Tables

### Tables Checked for Existence

The following tables were checked but **not found** in the database:

- gbp_local_service_ads_metrics
- gbp_revenue
- gbp_calls_data
- gbp_insights
- gbp_location_metrics
- gbp_phone_leads
- gbp_message_leads
- gbp_post_metrics
- gbp_reviews
- gbp_photos
- gbp_business_hours
- google_ads_metrics
- google_ads_conversions
- metrics_summary
- daily_metrics

### Conclusion

**Only 2 main metric tables exist:**
1. `client_metrics_summary` - Client-level aggregated daily metrics
2. `gbp_location_daily_metrics` - Location-level daily GBP metrics

There are no separate tables for:
- Revenue data
- Advanced GBP analytics
- Breakdown metrics
- Detailed conversion tracking

---

## 4. Sample Data Analysis - Latest 5 Days

### Example Client: CHIROPRACTIC CARE CENTRE
**Client ID:** 5cfa675b-13a4-4661-a744-e1158c76b376

#### Latest 5 Days from client_metrics_summary

| Date | GBP Calls | GBP Directions | GBP Web Clicks | Profile Views | Ads Conv | Ads Imp | Ads Clicks | Ad Spend | Sessions |
|---|---|---|---|---|---|---|---|---|---|
| 2026-02-02 | 0 | 0 | 0 | 0 | 0 | 48 | 5 | $28.42 | 42 |
| 2026-02-01 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | $0 | 0 |
| 2026-01-31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0 | 0 |
| 2026-01-30 | 0 | 0 | 0 | 0 | 0 | 101 | 3 | $20.09 | 0 |
| 2026-01-29 | 0 | 0 | 0 | 0 | 0 | 29 | 1 | $26.93 | 0 |

**Observations:**
- GBP metrics are all zero (typical pattern)
- Google Ads is the main active channel (48-101 impressions)
- Ad spend ranges from $0 to $28
- High variance in ad impressions across days
- Sessions data is sparse

#### Latest 5 Days from gbp_location_daily_metrics

| Date | Views | Actions | Phone Calls | Directions | Web Clicks | Total Reviews | Avg Rating |
|---|---|---|---|---|---|---|---|
| 2025-12-31 | 100 | 10 | 2 | 1 | 3 | 4 | 4.5 |
| 2025-12-10 | 0 | 0 | 5 | 9 | 3 | 0 | N/A |
| 2025-12-09 | 0 | 0 | 1 | 6 | 1 | 0 | N/A |
| 2025-12-08 | 0 | 0 | 7 | 10 | 9 | 0 | N/A |
| 2025-12-07 | 0 | 0 | 1 | 1 | 1 | 0 | N/A |

**Observations:**
- Phone calls, direction requests, and website clicks are populated consistently
- Most other fields are zero
- Views and actions data only appears on Dec 31 (new year effect or special event)
- Ratings only populated on one date
- Direction requests and phone calls show typical business activity patterns

---

## 5. Database Summary Statistics

| Metric | Value |
|---|---|
| Total Records in client_metrics_summary | 1,000 |
| Total Records in gbp_location_daily_metrics | 1,000 |
| Total Clients in Database | 25 |
| Earliest Date (All Metrics) | 2025-02-10 |
| Latest Date (All Metrics) | 2026-01-19 |
| Earliest Date (GBP Metrics) | 2025-01-01 |
| Latest Date (GBP Metrics) | 2026-01-19 |
| **Date Coverage** | **~11 months** |

---

## 6. Data Reliability Matrix

### Columns with Real, Usable Data

| Category | Metric | Reliability | Best For |
|---|---|---|---|
| **GBP Basics** | phone_calls | 65.2% | Trend analysis, baseline reporting |
| **GBP Basics** | direction_requests | 72.7% | Trend analysis, baseline reporting |
| **GBP Basics** | website_clicks | 84.8% | Primary GBP engagement metric |
| **Google Ads** | ads_impressions | 47.0% | Campaign analysis |
| **Google Ads** | ads_clicks | 45.8% | Campaign performance |
| **Google Ads** | google_ads_conversions | 27.9% | Conversion tracking |
| **Google Ads** | ad_spend | 45.8% | ROI/Budget analysis |
| **SEO** | seo_impressions | 15.7% | Organic search performance |
| **SEO** | seo_clicks | 15.2% | Organic click tracking |
| **Traffic** | sessions | 15.7% | Website traffic baseline |
| **Health** | health_score | 100% | Overall health tracking |
| **Budget** | budget_utilization | 100% | Budget management |

### Columns NOT READY FOR PRODUCTION

| Category | Metric | Issue | Recommendation |
|---|---|---|---|
| **Derived Metrics** | ads_ctr | 0% populated | Calculate from clicks/impressions |
| **Derived Metrics** | conversion_rate | 0% populated | Calculate from conversions/clicks |
| **Derived Metrics** | cpl | 0% populated | Calculate from spend/leads |
| **Traffic Breakdown** | traffic_direct | 0% populated | Implement GA4 integration |
| **Traffic Breakdown** | traffic_organic | 0% populated | Implement GA4 integration |
| **Session Details** | sessions_desktop | 0% populated | Implement GA4 integration |
| **Session Details** | sessions_mobile | 0% populated | Implement GA4 integration |
| **Posts** | gbp_posts_views | 0% populated | Implement GBP Post API |
| **Reviews** | gbp_reviews_new | 0% populated | Implement review tracking |
| **Photos** | business_photo_views | 0% populated | Implement photo API |

---

## 7. Data Pipeline Analysis

### What's Working
1. ✅ Google Ads API integration (impressions, clicks, conversions, spend)
2. ✅ GBP location API (phone calls, directions, website clicks)
3. ✅ Basic health scoring
4. ✅ Budget tracking

### What's Partially Working
1. ⚠️ GBP client-level aggregation (only basic metrics, low data volume)
2. ⚠️ SEO metrics (15% populated - possible GA4 integration)
3. ⚠️ Sessions tracking (15% populated)

### What's Not Working
1. ❌ GBP advanced metrics (photos, posts, reviews)
2. ❌ Traffic source breakdown
3. ❌ Session-level breakdown (desktop/mobile)
4. ❌ Derived metrics calculations
5. ❌ Google rank tracking
6. ❌ Content conversion tracking

---

## 8. Recommendations

### Short-term (Use Current Data As-Is)

1. **For Dashboards & Reporting:**
   - Focus on GBP location metrics (phone_calls, direction_requests, website_clicks)
   - Use Google Ads data (impressions, clicks, conversions, spend)
   - Display health_score and budget_utilization for overview
   - Show SEO metrics where available (15% coverage)

2. **Handle Missing Data Gracefully:**
   - Show "No data available" for zero-populated fields
   - Use conditional rendering for sparse metrics
   - Highlight metrics with >50% data population

3. **Avoid These in Production:**
   - Don't display traffic source breakdowns
   - Don't show desktop/mobile split
   - Don't calculate CTR, conversion rates, or CPA from database fields
   - Don't show post/photo/review metrics

### Medium-term (Improve Data Collection)

1. **Implement Derived Metrics:**
   - Calculate CTR = clicks/impressions
   - Calculate conversion_rate = conversions/clicks
   - Calculate CPA = spend/conversions

2. **Expand GBP Integration:**
   - Add photo metrics collection
   - Add post performance tracking
   - Add review monitoring (new reviews per day)
   - Add search term tracking (searches_direct, searches_discovery)

3. **Complete Analytics Integration:**
   - Implement full GA4 integration for traffic sources
   - Split sessions by device type
   - Track user segments
   - Enable all custom event tracking

### Long-term (Enhance Database Schema)

1. **Add Revenue Tracking Table:**
   - Create `gbp_revenue` table if tracking is available
   - Link revenue to specific clients/locations

2. **Create Detailed Breakdown Tables:**
   - `gbp_post_metrics` - Post-level performance
   - `gbp_review_metrics` - Review tracking over time
   - `gbp_search_analytics` - Search term performance
   - `google_ads_keywords` - Keyword-level metrics

3. **Implement Time-Series Aggregations:**
   - Weekly and monthly rollups
   - Year-over-year comparisons
   - Trend analysis tables

---

## 9. Query Reference

### Common SQL Patterns for This Database

#### Get Latest Data for a Client
```sql
SELECT * FROM client_metrics_summary
WHERE client_id = 'YOUR_CLIENT_ID'
ORDER BY date DESC
LIMIT 30;
```

#### Get Data with Non-Zero GBP Metrics
```sql
SELECT * FROM gbp_location_daily_metrics
WHERE phone_calls > 0 OR direction_requests > 0 OR website_clicks > 0
ORDER BY date DESC;
```

#### Get Clients with Google Ads Data
```sql
SELECT DISTINCT client_id
FROM client_metrics_summary
WHERE ads_impressions > 0 OR google_ads_conversions > 0;
```

#### Aggregate Metrics by Date Range
```sql
SELECT
  DATE_TRUNC('month', date) as month,
  client_id,
  SUM(ads_impressions) as total_impressions,
  SUM(ads_clicks) as total_clicks,
  SUM(google_ads_conversions) as total_conversions,
  SUM(ad_spend) as total_spend
FROM client_metrics_summary
WHERE date BETWEEN '2026-01-01' AND '2026-02-01'
GROUP BY DATE_TRUNC('month', date), client_id
ORDER BY month DESC;
```

#### Compare GBP Location Metrics
```sql
SELECT
  client_id,
  SUM(phone_calls) as total_calls,
  SUM(direction_requests) as total_directions,
  SUM(website_clicks) as total_web_clicks,
  AVG(CASE WHEN phone_calls > 0 THEN phone_calls END) as avg_calls_when_present
FROM gbp_location_daily_metrics
WHERE date >= '2026-01-01'
GROUP BY client_id
ORDER BY total_calls DESC;
```

---

## 10. Conclusion

The Supabase database contains **solid foundational data** primarily driven by Google Ads and GBP location-level metrics. The database is reliable for:

- **Reporting on paid advertising performance**
- **Tracking local business profile engagement** (phone, directions, website clicks)
- **Client health scoring**
- **Budget management**

However, the database **lacks depth** in:

- **Advanced GBP analytics** (posts, photos, reviews)
- **Traffic source attribution**
- **Session-level analysis**
- **Derived metrics calculations**
- **Comprehensive lead tracking**

**Recommendation:** Use current data as-is for MVP/initial dashboards, but plan data collection expansion for:
1. Complete GBP API integration
2. Full GA4 integration for traffic analysis
3. Advanced conversion tracking

---

**Report Generated:** 2026-02-03
**Analysis Tool:** Node.js with Supabase Client Library
**Status:** ✅ Analysis Complete
