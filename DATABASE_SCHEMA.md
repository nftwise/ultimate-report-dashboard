# Supabase Database Schema Reference

> **IMPORTANT**: Claude MUST read this file before working on any dashboard feature.
> This file contains the complete database schema with all tables and columns.

Generated: 2026-02-09T04:23:10.104Z

---

## Quick Reference

### GBP (Google Business Profile) Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `gbp_location_daily_metrics` | Detailed daily GBP metrics | phone_calls, website_clicks, direction_requests, views |
| `client_metrics_summary` | Aggregated metrics (different column names!) | gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views |
| `gbp_locations` | Location info | location_name, address, phone |
| `gbp_posts` | GBP posts data | post_title, views, actions |

### Google Ads Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ads_campaign_metrics` | Campaign performance | impressions, clicks, cost, conversions |
| `ads_ad_group_metrics` | Ad group performance | ad_group_name, impressions, clicks, cost |
| `campaign_conversion_actions` | Conversion tracking | conversions, conversion_action_name |
| `campaign_search_terms` | Search terms | search_term, impressions, clicks, conversions |

### SEO/Analytics Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ga4_sessions` | GA4 session data | sessions, users, conversions |
| `ga4_events` | GA4 events | event_name, event_count |
| `ga4_landing_pages` | Landing page data | landing_page, sessions, conversions |
| `gsc_queries` | Search Console queries | query, clicks, impressions, position |
| `gsc_pages` | Search Console pages | page, clicks, impressions |

---

## Complete Table Schemas

### clients

**Columns (31):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 0459d9d5-f4c6-444e-8f66-2c9f225deeb6 | string |
| `name` | Zen Care Physical Medicine | string |
| `slug` | zencare | string |
| `industry` | chiropractic | string |
| `logo_url` | NULL | null |
| `primary_color` | #3B82F6 | string |
| `contact_name` | Jay Kang | string |
| `contact_email` | jay@zencare.com | string |
| `contact_phone` | NULL | null |
| `plan_type` | standard | string |
| `is_active` | true | boolean |
| `created_at` | 2025-10-22T22:10:01.321254+00:00 | string |
| `updated_at` | 2025-10-22T22:10:01.321254+00:00 | string |
| `city` | Irvine, CA | string |
| `owner` | Jay Kang | string |
| `website_url` | https://zencare.com/ | string |
| `address` | NULL | null |
| `phone` | NULL | null |
| `doctor_name` | NULL | null |
| `status` | Working | string |
| `seo_rating` | NULL | null |
| `ads_rating` | NULL | null |
| `ads_budget_month` | NULL | null |
| `notes` | Pending GBP location ID from user | string |
| `has_seo` | true | boolean |
| `has_ads` | true | boolean |
| `has_gbp` | false | boolean |
| `has_callrail` | false | boolean |
| `wordpress_site` | NULL | null |
| `google_ads_customer_id` | 502-248-5586 | string |
| `ga4_property_id` | 310666159 | string |

**Total Rows:** 25

---

### client_metrics_summary

**Columns (66):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 1a111af4-f651-4615-af42-422a8b0abef1 | string |
| `client_id` | 470f1e4d-2287-447d-a146-40c439c68c20 | string |
| `date` | 2025-10-22 | string |
| `period_type` | daily | string |
| `google_ads_conversions` | 0 | number |
| `ad_spend` | 0 | number |
| `form_fills` | 0 | number |
| `gbp_calls` | 0 | number |
| `google_rank` | NULL | null |
| `top_keywords` | 0 | number |
| `total_leads` | 0 | number |
| `cpl` | 0 | number |
| `created_at` | 2025-12-18T10:32:30.037651+00:00 | string |
| `updated_at` | 2026-01-21T06:22:54.316+00:00 | string |
| `sessions` | 0 | number |
| `users` | 0 | number |
| `new_users` | 0 | number |
| `traffic_organic` | 0 | number |
| `traffic_paid` | 0 | number |
| `traffic_direct` | 0 | number |
| `traffic_referral` | 0 | number |
| `traffic_ai` | 0 | number |
| `sessions_mobile` | 0 | number |
| `sessions_desktop` | 0 | number |
| `seo_impressions` | 0 | number |
| `seo_clicks` | 0 | number |
| `seo_ctr` | 0 | number |
| `branded_traffic` | 0 | number |
| `non_branded_traffic` | 0 | number |
| `keywords_improved` | 0 | number |
| `keywords_declined` | 0 | number |
| `ads_impressions` | 0 | number |
| `ads_clicks` | 0 | number |
| `ads_ctr` | 0 | number |
| `ads_avg_cpc` | 0 | number |
| `ads_impression_share` | 0 | number |
| `ads_search_lost_budget` | 0 | number |
| `ads_quality_score` | 0 | number |
| `ads_conversion_rate` | 0 | number |
| `ads_top_impression_rate` | 0 | number |
| `gbp_website_clicks` | 0 | number |
| `gbp_directions` | 0 | number |
| `gbp_profile_views` | 0 | number |
| `gbp_searches_direct` | 0 | number |
| `gbp_searches_discovery` | 0 | number |
| `gbp_reviews_count` | 0 | number |
| `gbp_reviews_new` | 0 | number |
| `gbp_rating_avg` | 0 | number |
| `gbp_q_and_a_count` | 0 | number |
| `days_since_review` | 0 | number |
| `gbp_photos_count` | 0 | number |
| `gbp_posts_count` | 0 | number |
| `gbp_posts_views` | 0 | number |
| `gbp_posts_clicks` | 0 | number |
| `days_since_post` | 0 | number |
| `health_score` | 60 | number |
| `mom_leads_change` | 0 | number |
| `alerts_count` | 0 | number |
| `budget_utilization` | 73 | number |
| `top_landing_pages` | JSON | object |
| `blog_sessions` | 0 | number |
| `content_conversions` | 0 | number |
| `engagement_rate` | 0 | number |
| `returning_users` | 0 | number |
| `conversion_rate` | 0 | number |
| `ads_phone_calls` | 0 | number |

**Total Rows:** 9628

---

### gbp_location_daily_metrics

**Columns (20):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 03e5a901-515e-4c4e-a054-0992b9fc357e | string |
| `location_id` | daac098e-f00e-435b-86c0-a15a6e31a4a6 | string |
| `client_id` | c1b7ff3f-2e7c-414f-8de8-469d952dcaa6 | string |
| `date` | 2025-01-15 | string |
| `views` | 150 | number |
| `actions` | 45 | number |
| `direction_requests` | 12 | number |
| `phone_calls` | 8 | number |
| `website_clicks` | 25 | number |
| `total_reviews` | 42 | number |
| `new_reviews_today` | 0 | number |
| `average_rating` | 4.8 | number |
| `business_photo_views` | 0 | number |
| `customer_photo_count` | 0 | number |
| `customer_photo_views` | 0 | number |
| `posts_count` | 0 | number |
| `posts_views` | 0 | number |
| `posts_actions` | 0 | number |
| `created_at` | 2026-01-23T14:57:59.3958+00:00 | string |
| `updated_at` | 2026-01-23T14:57:59.3958+00:00 | string |

**Total Rows:** 5921

---

### gbp_locations

**Columns (12):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 918932ee-2b84-40a4-9660-ed05d1138f3b | string |
| `client_id` | c83bbae9-5ee0-4924-8a2f-593aec45bd64 | string |
| `gbp_location_id` | locations/1179838587938338705 | string |
| `location_name` | North Alabama Spine & Rehab | string |
| `address` | NULL | null |
| `phone` | NULL | null |
| `website` | NULL | null |
| `business_type` | NULL | null |
| `is_active` | true | boolean |
| `synced_at` | NULL | null |
| `created_at` | 2026-01-24T03:24:16.362787+00:00 | string |
| `updated_at` | 2026-01-24T03:24:16.362787+00:00 | string |

**Total Rows:** 16

---

### gbp_posts

*No data available*

**Total Rows:** 0

---

### gbp_location_photos

*No data available*

**Total Rows:** 0

---

### ads_campaign_metrics

**Columns (22):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 270d5bd5-1507-4135-b34f-f62bc614c108 | string |
| `client_id` | 7fe8d45e-9171-4994-a9b7-2957d71ab750 | string |
| `campaign_id` | campaign_7fe8d45e-9171-4994-a9b7-2957d71ab750_0 | string |
| `campaign_name` | Emergency Services | string |
| `campaign_status` | ENABLED | string |
| `date` | 2026-01-14 | string |
| `impressions` | 824 | number |
| `clicks` | 56 | number |
| `cost` | 161.24 | number |
| `conversions` | 0 | number |
| `conversion_value` | 0 | number |
| `ctr` | 6.8 | number |
| `cpc` | 2.88 | number |
| `cpa` | 0 | number |
| `roas` | 0 | number |
| `quality_score` | 9 | number |
| `impression_share` | 87 | number |
| `search_impression_share` | 82 | number |
| `search_lost_is_budget` | 4 | number |
| `search_lost_is_rank` | 12 | number |
| `created_at` | 2026-01-14T10:51:18.073787 | string |
| `updated_at` | 2026-01-14T10:51:18.073787 | string |

**Total Rows:** 6991

---

### ads_ad_group_metrics

**Columns (14):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 36a3c527-39ed-4729-b189-25d01a6e5e68 | string |
| `client_id` | 939903b3-bbcf-4768-938f-1b17395eec95 | string |
| `campaign_id` | 22550428064 | string |
| `ad_group_id` | 183355914390 | string |
| `ad_group_name` | Back Pain | string |
| `date` | 2025-10-29 | string |
| `impressions` | 21 | number |
| `clicks` | 0 | number |
| `cost` | 0 | number |
| `conversions` | 0 | number |
| `ctr` | 0 | number |
| `cpc` | NULL | null |
| `cpa` | 0 | number |
| `created_at` | 2026-01-27T14:35:39.274465 | string |

**Total Rows:** 16914

---

### campaign_conversion_actions

**Columns (10):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | e60417d7-6f70-4126-a281-2439820b19a0 | string |
| `client_id` | 1da296c9-3de3-42bb-b5a6-e64561b94d16 | string |
| `campaign_id` | 20958859881 | string |
| `date` | 2025-01-02 | string |
| `conversion_action_name` | Call from web | string |
| `conversion_action_type` | 2 | string |
| `conversions` | 2 | number |
| `conversion_value` | 0 | number |
| `avg_conversion_lag_days` | 0 | number |
| `created_at` | 2026-01-27T16:23:05.063017+00:00 | string |

**Total Rows:** 4356

---

### campaign_search_terms

**Columns (13):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 32d756f2-a88a-4ba2-a9da-9a217f087130 | string |
| `client_id` | 5cfa675b-13a4-4661-a744-e1158c76b376 | string |
| `campaign_id` | 20974565416 | string |
| `date` | 2025-10-29 | string |
| `search_term` | sciatica treatment | string |
| `match_type` | 3 | string |
| `impressions` | 1 | number |
| `clicks` | 0 | number |
| `cost` | 0 | number |
| `conversions` | 0 | number |
| `is_irrelevant` | false | boolean |
| `wasted_spend` | 0 | number |
| `created_at` | 2026-01-27T14:19:31.198861+00:00 | string |

**Total Rows:** 272615

---

### ga4_sessions

**Columns (23):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | ca650296-2191-4d6f-a397-9c90f954501b | string |
| `client_id` | c1b7ff3f-2e7c-414f-8de8-469d952dcaa6 | string |
| `date` | 2026-01-01 | string |
| `source_medium` | (not set) | string |
| `device` | desktop | string |
| `country` | Singapore | string |
| `city` | NULL | null |
| `region` | NULL | null |
| `sessions` | 39 | number |
| `total_users` | 39 | number |
| `new_users` | 0 | number |
| `page_views` | 0 | number |
| `screen_page_views` | 0 | number |
| `engagement_rate` | 0 | number |
| `avg_session_duration` | 0 | number |
| `user_engagement_duration` | 681 | number |
| `bounce_rate` | 1 | number |
| `conversions` | 0 | number |
| `conversion_rate` | 0 | number |
| `event_count` | 39 | number |
| `events_per_session` | 1 | number |
| `created_at` | 2026-02-03T03:13:58.291405 | string |
| `updated_at` | 2026-02-03T03:13:58.291405 | string |

**Total Rows:** 83120

---

### ga4_events

**Columns (11):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 2513b53e-1145-43fb-8a96-a3d81a36e0b1 | string |
| `client_id` | 3c80f930-5f4d-49d6-9428-f2440e496aac | string |
| `date` | 2025-03-09 | string |
| `event_name` | first_visit | string |
| `source_medium` | (direct) / (none) | string |
| `device` | desktop | string |
| `event_count` | 4 | number |
| `total_users` | 4 | number |
| `event_value` | 0 | number |
| `created_at` | 2026-02-03T03:12:33.45987 | string |
| `updated_at` | 2026-02-03T03:12:33.45987 | string |

**Total Rows:** 217614

---

### ga4_conversions

**Columns (12):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | eb245e10-b72a-429a-b39c-f66e6ae6eb44 | string |
| `client_id` | 5cfa675b-13a4-4661-a744-e1158c76b376 | string |
| `date` | 2025-06-16 | string |
| `conversion_event` | Appointment | string |
| `source_medium` | google / organic | string |
| `device` | mobile | string |
| `conversions` | 15 | number |
| `total_users` | 5 | number |
| `conversion_rate` | 0 | number |
| `conversion_value` | 0 | number |
| `created_at` | 2026-02-02T14:10:26.830245 | string |
| `updated_at` | 2026-02-02T14:10:26.830245 | string |

**Total Rows:** 15248

---

### ga4_landing_pages

**Columns (14):**

| Column | Sample Value | Type |
|--------|--------------|------|
| `id` | 32c3d11f-5912-4b96-865b-62946d145266 | string |
| `client_id` | c73fbf15-865f-43f0-9b57-ea7301d537e7 | string |
| `date` | 2024-12-31 | string |
| `landing_page` | / | string |
| `source_medium` | (direct) / (none) | string |
| `sessions` | 6 | number |
| `total_users` | 6 | number |
| `new_users` | 6 | number |
| `avg_session_duration` | 192.89 | number |
| `bounce_rate` | 0.666667 | number |
| `conversions` | 1 | number |
| `conversion_rate` | 0.166667 | number |
| `created_at` | 2026-02-02T14:09:12.210412 | string |
| `updated_at` | 2026-02-02T14:09:12.210412 | string |

**Total Rows:** 129514

---

### gsc_queries

⚠️ Error accessing table: canceling statement due to statement timeout

---

### gsc_pages

*No data available*

**Total Rows:** 0

---

## Column Name Mapping (IMPORTANT!)

### GBP Columns: gbp_location_daily_metrics vs client_metrics_summary

| gbp_location_daily_metrics | client_metrics_summary | Description |
|---------------------------|------------------------|-------------|
| `phone_calls` | `gbp_calls` | Phone calls from GBP |
| `website_clicks` | `gbp_website_clicks` | Website clicks |
| `direction_requests` | `gbp_directions` | Direction requests |
| `views` | `gbp_profile_views` | Profile views |
| `total_reviews` | `gbp_reviews_count` | Total review count |
| `new_reviews_today` | `gbp_reviews_new` | New reviews |
| `average_rating` | `gbp_rating_avg` | Average star rating |
| `posts_count` | `gbp_posts_count` | Active posts |
| `posts_views` | `gbp_posts_views` | Post views |
| `posts_actions` | `gbp_posts_clicks` | Post clicks/actions |

### When to use which table:
- **gbp_location_daily_metrics**: Use for detailed GBP analytics page
- **client_metrics_summary**: Use for overview/dashboard pages (has ALL metrics aggregated)

---

## Usage Examples

### Fetching GBP Data (with fallback)
```typescript
// Fetch from BOTH tables and merge
const { data: gbpData } = await supabase
  .from('gbp_location_daily_metrics')
  .select('date, phone_calls, website_clicks, direction_requests, views')
  .eq('client_id', clientId);

const { data: summaryData } = await supabase
  .from('client_metrics_summary')
  .select('date, gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
  .eq('client_id', clientId);

// Merge: prefer gbpData, fallback to summaryData
```

### Fetching Ads Data
```typescript
const { data: campaignData } = await supabase
  .from('ads_campaign_metrics')
  .select('date, impressions, clicks, cost, conversions')
  .eq('client_id', clientId);

const { data: conversions } = await supabase
  .from('campaign_conversion_actions')
  .select('date, conversions, conversion_action_name')
  .eq('client_id', clientId);
```

### Fetching SEO Data
```typescript
const { data: sessions } = await supabase
  .from('ga4_sessions')
  .select('date, sessions, users, conversions')
  .eq('client_id', clientId);

const { data: keywords } = await supabase
  .from('gsc_queries')
  .select('query, clicks, impressions, ctr, position')
  .eq('client_id', clientId);
```

---

## Notes

1. **Always check BOTH GBP tables** - data may exist in one but not the other
2. **Column names differ** between tables - use the mapping above
3. **client_metrics_summary** is the main aggregated table with 66 columns
4. **Date format** is always 'YYYY-MM-DD' string
5. **client_id** is UUID format

